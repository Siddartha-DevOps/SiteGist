import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "~/database/db.server";
import { streamRAG } from "~/ai-layer/ai.server";

const CRISP_API = "https://api.crisp.chat/v1";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = body?.event;
  const data = body?.data || {};

  // Only respond to genuine inbound visitor text messages.
  // Ignore operator/plugin messages to avoid loops, and respect human takeover.
  if (event !== "message:send") return json({ ok: true });
  if (data.from !== "user") return json({ ok: true });
  if (data.type !== "text") return json({ ok: true });

  const websiteId = data.website_id;
  const sessionId = data.session_id;
  const text = typeof data.content === "string" ? data.content : "";

  if (!websiteId || !sessionId || !text) return json({ ok: true });

  // Map Crisp website_id -> SiteGist project via the stored Integration.
  const integration = await prisma.integration.findFirst({
    where: { provider: "crisp" },
    // Json filter: details.website_id === websiteId
    // (If your Prisma/Postgres setup needs it, replace with a raw filter; see note below.)
  }).then(async () => {
    const all = await prisma.integration.findMany({ where: { provider: "crisp" } });
    return all.find((i) => (i.details as any)?.website_id === websiteId) || null;
  });

  if (!integration) return json({ ok: true });

  const project = await prisma.project.findUnique({ where: { id: integration.projectId } });
  if (!project) return json({ ok: true });

  const settings = (project.settings as any) || {};
  const systemPrompt =
    settings.systemPrompt ||
    "You are a helpful assistant for this website. Answer based on the content provided.";

  // Generate the answer using SiteGist's existing RAG engine (consumed as a string).
  let answer = "";
  try {
    for await (const chunk of streamRAG(project.id, text, systemPrompt, [])) {
      if (chunk.startsWith("METADATA:")) continue;
      if (chunk.startsWith("[ERROR]")) { answer = ""; break; }
      answer += chunk;
    }
  } catch (e) {
    console.error("[Crisp] RAG error:", e);
    return json({ ok: true });
  }

  if (!answer.trim()) return json({ ok: true });

  // Post the answer back INTO the Crisp conversation as an operator message.
  const pluginId = process.env.CRISP_PLUGIN_ID;
  const pluginKey = process.env.CRISP_PLUGIN_KEY;
  const auth = Buffer.from(`${pluginId}:${pluginKey}`).toString("base64");

  try {
    await fetch(`${CRISP_API}/website/${websiteId}/conversation/${sessionId}/message`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "X-Crisp-Tier": "plugin",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "text",
        from: "operator",
        origin: "chat",
        content: answer,
      }),
    });
  } catch (e) {
    console.error("[Crisp] Failed to send reply:", e);
  }

  return json({ ok: true });
}
