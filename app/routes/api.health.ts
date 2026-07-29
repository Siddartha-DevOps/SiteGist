import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { prisma } from "~/database/db.server";
import { getRedis } from "~/lib/redis.server";
import { env } from "~/env.server";

/**
 * GET /api/health — production health/readiness probe.
 *
 * Safe for public uptime monitors: by default it returns only per-service
 * status enums (+ latency), never secrets, stats, model lists, or raw errors.
 * Returns HTTP 503 when a critical dependency (database or LLM) is down so
 * monitors alert. Set HEALTHCHECK_TOKEN and pass ?token=… for verbose detail;
 * add &deep=1 to run a real (billable) OpenAI ping — off by default so this
 * endpoint can't be hammered to burn tokens.
 */
type Svc = { status: "ok" | "error" | "not_configured"; ms?: number; note?: string; detail?: string; [k: string]: unknown };

async function ping(fn: () => Promise<unknown>): Promise<Svc> {
  const t = Date.now();
  try {
    await fn();
    return { status: "ok", ms: Date.now() - t };
  } catch (e: any) {
    return { status: "error", ms: Date.now() - t, detail: e?.message };
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const token = process.env.HEALTHCHECK_TOKEN;
  const verbose = !!token && url.searchParams.get("token") === token;
  const deep = verbose && url.searchParams.get("deep") === "1";

  const services: Record<string, Svc> = {};

  // Database — critical.
  services.database = await ping(() => prisma.$queryRaw`SELECT 1`);

  // LLM generation — critical (the bot can't answer without it). Config-only by
  // default; a real provider ping only in authorized deep mode.
  const hasOpenAI = !!(process.env.OPENAI_API_KEY || process.env.OPENAI_KEY);
  const hasGemini = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  const hasPortkey = !!process.env.PORTKEY_API_KEY;
  if (!hasOpenAI && !hasGemini && !hasPortkey) {
    services.llm = { status: "not_configured", note: "No OpenAI/Gemini/Portkey key — the chatbot cannot generate answers." };
  } else if (deep && hasOpenAI) {
    services.llm = await ping(async () => {
      const OpenAI = (await import("openai")).default;
      await new OpenAI({ apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_KEY }).models.list();
    });
  } else {
    services.llm = { status: "ok", mode: "config-only", providers: { openai: hasOpenAI, gemini: hasGemini, portkey: hasPortkey }, model: process.env.PORTKEY_MODEL || "gpt-4.1-mini (default)" };
  }

  // Redis — abuse protection / rate limiting. Missing = global abuse protection OFF.
  const redis = getRedis();
  services.redis = redis
    ? await ping(() => (redis as any).ping())
    : { status: "not_configured", note: "Global abuse protection is OFF — set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN, or bots can run up the LLM bill." };

  // Pinecone — vector store (cheap network call, no tokens).
  services.pinecone = process.env.PINECONE_API_KEY
    ? await ping(async () => {
        const { pineconeIndex } = await import("~/lib/pinecone.server");
        await pineconeIndex.describeIndexStats();
      })
    : { status: "not_configured" };

  // Email — magic-link login. No key = users literally cannot log in.
  services.email = process.env.RESEND_API_KEY
    ? { status: "ok", sender: process.env.SENDER_EMAIL || "support@sitegist.co", note: "Configured. True deliverability still needs a real test send." }
    : { status: "not_configured", note: "RESEND_API_KEY missing — login magic-link emails will NOT send; users cannot log in." };

  // Reranking — answer quality (optional).
  services.rerank = env.RERANK_ENABLED
    ? { status: "ok" }
    : { status: "not_configured", note: "Reranking disabled — set RERANK_ENABLED=true (+ Portkey/Cohere keys or RERANK_URL) for best relevance." };

  const dbOk = services.database.status === "ok";
  const llmOk = services.llm.status === "ok";
  const degraded = ["redis", "pinecone", "email", "rerank"].some((k) => services[k].status !== "ok");
  const overall = !dbOk || !llmOk ? "unhealthy" : degraded ? "degraded" : "ok";

  // Public callers get status enums only — strip detail/notes/providers/etc.
  const publicServices: Record<string, { status: string; ms?: number }> = {};
  for (const [k, v] of Object.entries(services)) {
    publicServices[k] = v.ms != null ? { status: v.status, ms: v.ms } : { status: v.status };
  }

  return json(
    {
      status: overall,
      timestamp: new Date().toISOString(),
      commit: (process.env.VERCEL_GIT_COMMIT_SHA || "dev").slice(0, 7),
      services: verbose ? services : publicServices,
    },
    { status: overall === "unhealthy" ? 503 : 200 }
  );
}
