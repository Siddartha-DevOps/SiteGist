/**
 * Agentic AI Actions (function-calling).
 *
 * Per-project HTTP "tools" the chatbot can invoke at answer time — e.g. look up an
 * order, book a demo, or hit a customer's own API — and then ground its reply on the
 * live result. This module:
 *   1. loads a project's enabled actions,
 *   2. exposes them to the LLM as tool/function definitions (OpenAI + Gemini),
 *   3. lets the model decide whether a tool is needed for the user's query,
 *   4. executes the chosen action(s) server-side through an SSRF-guarded fetch, and
 *   5. returns the results so streamRAG can inject them into the answer context.
 *
 * Security: action URLs are operator-configured but still resolved + range-checked
 * before every request to block SSRF against localhost / private / link-local / cloud
 * metadata endpoints. Configured headers (which may contain secrets) are sent to the
 * target only — never exposed to the LLM or the browser.
 */
import dns from "node:dns/promises";

export type ProjectActionRow = {
  id: string;
  name: string;
  description: string;
  parameters: any | null;
  method: string;
  urlTemplate: string;
  headers: any | null;
  bodyTemplate: string | null;
  timeoutMs: number;
  enabled: boolean;
};

const MAX_ACTION_CALLS = 3;          // cap tool calls per message
const MAX_RESULT_CHARS = 2000;       // truncate each action response fed back to the LLM
const HARD_TIMEOUT_CAP_MS = 15000;   // never let a configured timeout exceed this

export async function getEnabledActions(projectId: string): Promise<ProjectActionRow[]> {
  try {
    const { prisma } = await import("~/database/db.server");
    const rows = await prisma.projectAction.findMany({
      where: { projectId, enabled: true },
    });
    return rows as unknown as ProjectActionRow[];
  } catch (err) {
    console.error("[Agentic Actions] Failed to load actions:", err);
    return [];
  }
}

function defaultSchema(parameters: any | null) {
  if (parameters && typeof parameters === "object") return parameters;
  return { type: "object", properties: {} };
}

export function buildOpenAITools(actions: ProjectActionRow[]) {
  return actions.map((a) => ({
    type: "function" as const,
    function: {
      name: a.name,
      description: a.description,
      parameters: defaultSchema(a.parameters),
    },
  }));
}

export function buildGeminiFunctionDeclarations(actions: ProjectActionRow[]) {
  return actions.map((a) => ({
    name: a.name,
    description: a.description,
    parameters: defaultSchema(a.parameters),
  }));
}

// ---- SSRF protection -------------------------------------------------------

function ipv4ToParts(ip: string): number[] | null {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const parts = m.slice(1, 5).map(Number);
  if (parts.some((p) => p < 0 || p > 255)) return null;
  return parts;
}

function isPrivateIp(ip: string): boolean {
  const v4 = ipv4ToParts(ip);
  if (v4) {
    const [a, b] = v4;
    if (a === 0 || a === 127) return true;                 // 0.0.0.0/8, loopback
    if (a === 10) return true;                             // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true;      // 172.16.0.0/12
    if (a === 192 && b === 168) return true;               // 192.168.0.0/16
    if (a === 169 && b === 254) return true;               // link-local incl. 169.254.169.254 metadata
    if (a === 100 && b >= 64 && b <= 127) return true;     // 100.64.0.0/10 CGNAT
    if (a >= 224) return true;                             // multicast / reserved
    return false;
  }
  // IPv6
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;       // loopback / unspecified
  if (lower.startsWith("fe80")) return true;               // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique-local fc00::/7
  if (lower.startsWith("::ffff:")) {                       // IPv4-mapped
    const mapped = lower.split(":").pop();
    if (mapped && mapped.includes(".")) return isPrivateIp(mapped);
  }
  return false;
}

async function assertSafeUrl(rawUrl: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid action URL: ${rawUrl}`);
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new Error(`Blocked action URL protocol: ${u.protocol}`);
  }
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host === "metadata.google.internal") {
    throw new Error(`Blocked action host: ${host}`);
  }
  // If the host is an IP literal, check it directly; otherwise resolve and check all A/AAAA records.
  if (ipv4ToParts(host) || host.includes(":")) {
    if (isPrivateIp(host)) throw new Error(`Blocked private action IP: ${host}`);
  } else {
    let addrs: { address: string }[] = [];
    try {
      addrs = await dns.lookup(host, { all: true });
    } catch {
      throw new Error(`Could not resolve action host: ${host}`);
    }
    if (addrs.length === 0) throw new Error(`No DNS records for action host: ${host}`);
    for (const a of addrs) {
      if (isPrivateIp(a.address)) throw new Error(`Action host resolves to a private address: ${host} -> ${a.address}`);
    }
  }
  return u;
}

// ---- Execution -------------------------------------------------------------

function interpolate(template: string, args: Record<string, any>, urlEncode: boolean): string {
  return template.replace(/\{(\w+)\}/g, (_m, key) => {
    if (!(key in args) || args[key] == null) return "";
    const v = typeof args[key] === "object" ? JSON.stringify(args[key]) : String(args[key]);
    return urlEncode ? encodeURIComponent(v) : v;
  });
}

export async function executeProjectAction(
  action: ProjectActionRow,
  args: Record<string, any>
): Promise<{ ok: boolean; status: number; body: string }> {
  const method = (action.method || "GET").toUpperCase();
  const url = await assertSafeUrl(interpolate(action.urlTemplate, args, true));

  const headers: Record<string, string> = { "User-Agent": "SiteGist-Action/1.0" };
  if (action.headers && typeof action.headers === "object") {
    for (const [k, v] of Object.entries(action.headers)) {
      if (typeof v === "string") headers[k] = interpolate(v, args, false);
    }
  }

  let body: string | undefined;
  if (method !== "GET" && method !== "HEAD" && action.bodyTemplate) {
    body = interpolate(action.bodyTemplate, args, false);
    if (!Object.keys(headers).some((h) => h.toLowerCase() === "content-type")) {
      headers["Content-Type"] = "application/json";
    }
  }

  const timeout = Math.min(Math.max(action.timeoutMs || 8000, 1000), HARD_TIMEOUT_CAP_MS);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url.toString(), {
      method,
      headers,
      body,
      redirect: "manual", // do not auto-follow — a redirect could bypass the SSRF check
      signal: controller.signal,
    });
    const text = (await res.text()).slice(0, MAX_RESULT_CHARS);
    return { ok: res.ok, status: res.status, body: text };
  } finally {
    clearTimeout(timer);
  }
}

// ---- Orchestration ---------------------------------------------------------

type RanAction = { name: string; ok: boolean };

const DECISION_SYSTEM = `You can call actions (tools) to fetch live data or perform tasks for the user.
Only call an action when the user's request clearly requires live/external data or an operation a tool provides.
If no action is needed, do not call any tool. Never invent argument values — only use values the user supplied or that are clearly implied.`;

export async function runAgenticActions(opts: {
  projectId: string;
  query: string;
  history: { role: string; content: string }[];
  actions: ProjectActionRow[];
  openai: any | null;
  gemini: any | null;
  openaiModel: string;
  geminiModel: string;
}): Promise<{ ran: RanAction[]; resultsText: string } | null> {
  const { query, history, actions, openai, gemini, openaiModel, geminiModel } = opts;
  if (!actions || actions.length === 0) return null;

  const byName = new Map(actions.map((a) => [a.name, a]));
  const calls: { name: string; args: Record<string, any> }[] = [];

  try {
    if (openai) {
      const messages = [
        { role: "system", content: DECISION_SYSTEM },
        ...history.slice(-6).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
        { role: "user", content: query },
      ];
      const resp: any = await openai.chat.completions.create(
        { model: openaiModel, messages, tools: buildOpenAITools(actions), tool_choice: "auto", max_tokens: 512 },
        { timeout: 15000 }
      );
      const toolCalls = resp?.choices?.[0]?.message?.tool_calls || [];
      for (const tc of toolCalls.slice(0, MAX_ACTION_CALLS)) {
        const name = tc?.function?.name;
        if (!name || !byName.has(name)) continue;
        let parsed: Record<string, any> = {};
        try { parsed = JSON.parse(tc.function.arguments || "{}"); } catch { parsed = {}; }
        calls.push({ name, args: parsed });
      }
    } else if (gemini) {
      const contents = [
        ...history.slice(-6).map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        { role: "user", parts: [{ text: query }] },
      ];
      const resp: any = await gemini.models.generateContent({
        model: geminiModel,
        contents,
        config: {
          systemInstruction: DECISION_SYSTEM,
          tools: [{ functionDeclarations: buildGeminiFunctionDeclarations(actions) }],
        },
      });
      const fnCalls = resp?.functionCalls || [];
      for (const fc of fnCalls.slice(0, MAX_ACTION_CALLS)) {
        if (!fc?.name || !byName.has(fc.name)) continue;
        calls.push({ name: fc.name, args: (fc.args as Record<string, any>) || {} });
      }
    } else {
      return null;
    }
  } catch (err) {
    console.error("[Agentic Actions] Tool-decision step failed:", err);
    return null;
  }

  if (calls.length === 0) return null;

  const ran: RanAction[] = [];
  const lines: string[] = [];
  for (const call of calls) {
    const action = byName.get(call.name)!;
    try {
      const out = await executeProjectAction(action, call.args);
      ran.push({ name: call.name, ok: out.ok });
      lines.push(`- ${call.name}(${JSON.stringify(call.args)}) -> HTTP ${out.status}\n${out.body}`);
    } catch (err: any) {
      ran.push({ name: call.name, ok: false });
      lines.push(`- ${call.name}(${JSON.stringify(call.args)}) -> ERROR: ${err?.message || "action failed"}`);
      console.error(`[Agentic Actions] Execution failed for "${call.name}":`, err?.message);
    }
  }

  const resultsText = `LIVE ACTION RESULTS (fetched just now via this site's configured actions — treat as authoritative and base your answer on them):\n${lines.join("\n")}`;
  return { ran, resultsText };
}
