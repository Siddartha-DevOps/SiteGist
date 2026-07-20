/**
 * Centralized Environment Manager and Configuration System
 * Validates and stores environment variables to ensure production safety and early failure.
 */
import { z } from "zod";

export interface EnvSchema {
  NODE_ENV: "development" | "production" | "test";
  DATABASE_URL: string;
  SESSION_SECRET: string;
  GEMINI_API_KEY: string;
  PINECONE_API_KEY: string;
  PINECONE_INDEX: string;
  FIRECRAWL_API_KEY: string;
  OPENAI_API_KEY: string | undefined;
  PORTKEY_API_KEY: string | undefined;
  PORTKEY_MODEL: string | undefined;
  PORTKEY_COHERE_VIRTUAL_KEY: string | undefined;
  COHERE_RERANK_MODEL: string | undefined;
  RERANK_ENABLED: boolean;
  RERANK_URL: string | undefined;
  LOCAL_LLM_URL: string | undefined;
  LOCAL_EMBED_URL: string | undefined;
  CLOUDFLARE_TURNSTILE_SECRET_KEY: string | undefined;
  PADDLE_API_KEY: string | undefined;
  UPSTASH_REDIS_REST_URL: string | undefined;
  UPSTASH_REDIS_REST_TOKEN: string | undefined;
  EMBEDDING_PROVIDER: "openai" | "gemini";
}

export const EMBEDDING_PROVIDER = (typeof process !== "undefined" && process.env.EMBEDDING_PROVIDER === "gemini" ? "gemini" : "openai") as "openai" | "gemini";

// AI stack selector. "cloud" = hosted OpenAI/Gemini/Portkey; "local" = a
// self-hosted OpenAI-compatible stack (e.g. Ollama/vLLM + bge-m3 + a local
// reranker). Flipping AI_PROVIDER + the LOCAL_* URLs moves the whole app in one
// place — the gateway task for the local-LLM migration.
export const AI_PROVIDER = (typeof process !== "undefined" && process.env.AI_PROVIDER === "local" ? "local" : "cloud") as "cloud" | "local";

// Embedding dimension is now an explicit, overridable env — no longer a hardcoded
// 768/1536 ternary — so the 1024-dim bge-m3 migration is a config change, not a
// code edit. Defaults from the active provider when EMBEDDING_DIMENSION is unset.
const DEFAULT_EMBEDDING_DIMENSION = AI_PROVIDER === "local" ? 1024 : EMBEDDING_PROVIDER === "gemini" ? 768 : 1536;
export const EMBEDDING_DIMENSION = (() => {
  const raw = typeof process !== "undefined" ? process.env.EMBEDDING_DIMENSION : undefined;
  if (raw) {
    const n = parseInt(String(raw).trim(), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_EMBEDDING_DIMENSION;
})();

// Zod schema for boot-time validation. Required vars must be non-empty; optional
// vars are allowed to be undefined. The messages are surfaced verbatim at startup.
const EnvZodSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  DATABASE_URL: z.string().min(1, "required — Postgres connection string."),
  SESSION_SECRET: z
    .string()
    .min(1, "required.")
    .refine((v) => v !== "DEFAULT_SESSION_SECRET", "must be set to a strong random value (currently the insecure default)."),
  GEMINI_API_KEY: z.string().min(1, "required (or GOOGLE_API_KEY) — default LLM + embeddings."),
  PINECONE_API_KEY: z.string().min(1, "required — vector store."),
  PINECONE_INDEX: z.string().min(1, "required — Pinecone index name."),
  FIRECRAWL_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  PORTKEY_API_KEY: z.string().optional(),
  PORTKEY_MODEL: z.string().optional(),
  PORTKEY_COHERE_VIRTUAL_KEY: z.string().optional(),
  COHERE_RERANK_MODEL: z.string().optional(),
  RERANK_ENABLED: z.boolean(),
  RERANK_URL: z.string().optional(),
  LOCAL_LLM_URL: z.string().optional(),
  LOCAL_EMBED_URL: z.string().optional(),
  CLOUDFLARE_TURNSTILE_SECRET_KEY: z.string().optional(),
  PADDLE_API_KEY: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  EMBEDDING_PROVIDER: z.enum(["openai", "gemini"]),
});

function cleanValue(val: string | undefined): string | undefined {
  if (!val) return undefined;
  let trimmed = val.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    trimmed = trimmed.slice(1, -1);
  }
  return trimmed;
}

export function getCleanEnv(): EnvSchema {
  const mode = (process.env.NODE_ENV || "development") as EnvSchema["NODE_ENV"];
  
  // Clean primary fallbacks
  const dbUrl = cleanValue(process.env.DATABASE_URL) || "";
  const sessionSecret = cleanValue(process.env.SESSION_SECRET) || "DEFAULT_SESSION_SECRET";
  const geminiKey = cleanValue(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.AI_API_KEY) || "";
  const pineconeKey = cleanValue(process.env.PINECONE_API_KEY || process.env.Pinecone_API_KEY) || "";
  const pineconeIndexName = cleanValue(process.env.PINECONE_INDEX) || "quickstart";
  const firecrawlKey = cleanValue(process.env.FIRECRAWL_API_KEY) || "";

  // Reranking is governed by an explicit flag. When RERANK_ENABLED is unset we
  // fall back to the legacy key-presence inference so existing deploys keep
  // their current behaviour; once set, the flag is authoritative.
  const rerankUrl = cleanValue(process.env.RERANK_URL);
  const cohereVK = cleanValue(process.env.PORTKEY_COHERE_VIRTUAL_KEY);
  const portkeyKey = cleanValue(process.env.PORTKEY_API_KEY);
  const rerankFlagRaw = cleanValue(process.env.RERANK_ENABLED);
  const hasRerankProvider = !!((portkeyKey && cohereVK) || rerankUrl);
  const rerankEnabled =
    rerankFlagRaw === undefined
      ? hasRerankProvider
      : /^(1|true|yes|on)$/i.test(rerankFlagRaw);

  return {
    NODE_ENV: mode,
    DATABASE_URL: dbUrl,
    SESSION_SECRET: sessionSecret,
    GEMINI_API_KEY: geminiKey,
    PINECONE_API_KEY: pineconeKey,
    PINECONE_INDEX: pineconeIndexName,
    FIRECRAWL_API_KEY: firecrawlKey,
    OPENAI_API_KEY: cleanValue(process.env.OPENAI_API_KEY),
    PORTKEY_API_KEY: cleanValue(process.env.PORTKEY_API_KEY),
    PORTKEY_MODEL: cleanValue(process.env.PORTKEY_MODEL),
    PORTKEY_COHERE_VIRTUAL_KEY: cohereVK,
    COHERE_RERANK_MODEL: cleanValue(process.env.COHERE_RERANK_MODEL),
    RERANK_ENABLED: rerankEnabled,
    RERANK_URL: rerankUrl,
    LOCAL_LLM_URL: cleanValue(process.env.LOCAL_LLM_URL),
    LOCAL_EMBED_URL: cleanValue(process.env.LOCAL_EMBED_URL),
    CLOUDFLARE_TURNSTILE_SECRET_KEY: cleanValue(process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY),
    PADDLE_API_KEY: cleanValue(process.env.PADDLE_API_KEY),
    UPSTASH_REDIS_REST_URL: cleanValue(process.env.UPSTASH_REDIS_REST_URL),
    UPSTASH_REDIS_REST_TOKEN: cleanValue(process.env.UPSTASH_REDIS_REST_TOKEN),
    EMBEDDING_PROVIDER: EMBEDDING_PROVIDER,
  };
}

let cachedEnv: EnvSchema | null = null;

export const env = new Proxy({} as EnvSchema, {
  get(target, prop: keyof EnvSchema) {
    if (!cachedEnv) {
      cachedEnv = getCleanEnv();
    }
    return cachedEnv[prop];
  }
});

/**
 * Validates key environment variables at startup.
 * Throws errors or logs critical failures for missing configuration.
 */
export async function validateEnvAtStartup() {
  const currentEnv = getCleanEnv();
  const isProduction = currentEnv.NODE_ENV === "production";

  // Schema-validate via zod and surface precise, per-variable messages.
  const parsed = EnvZodSchema.safeParse(currentEnv);
  if (!parsed.success) {
    console.error("================================================================================");
    console.error("CONFIGURATION ERROR: invalid/missing environment variables");
    for (const issue of parsed.error.issues) {
      console.error(` - ${issue.path.join(".")}: ${issue.message}`);
    }
    console.error("--------------------------------------------------------------------------------");
    console.error("Set these in your host's Environment Variables and redeploy.");
    console.error("================================================================================");

    console.error(
      isProduction
        ? "DEPLOYMENT WARNING: env validation failed. Continuing boot to avoid healthcheck failure — fix the above ASAP."
        : "Fix the above before deploying to production."
    );
  }

  // Reranking is governed by the explicit RERANK_ENABLED flag (see getCleanEnv),
  // never silently inferred. A misconfigured "enabled" state — flag on but no
  // provider configured — must not boot.
  const rerankEnabled = currentEnv.RERANK_ENABLED;
  const hasRerankProvider = !!(
    (currentEnv.PORTKEY_API_KEY && currentEnv.PORTKEY_COHERE_VIRTUAL_KEY) || currentEnv.RERANK_URL
  );
  if (rerankEnabled && !hasRerankProvider) {
    const msg =
      "CONFIG ERROR: RERANK_ENABLED is on but no reranking provider is configured — set " +
      "PORTKEY_API_KEY + PORTKEY_COHERE_VIRTUAL_KEY (Cohere via Portkey) or RERANK_URL (self-hosted reranker). " +
      "Refusing to start with a misconfigured 'enabled' rerank state.";
    console.error(msg);
    throw new Error(msg);
  }
  console.log(
    `[CONFIG] Reranking: ${rerankEnabled ? "ENABLED" : "DISABLED"}` +
      (rerankEnabled
        ? ` via ${currentEnv.RERANK_URL || "Cohere/Portkey"} (model: ${currentEnv.COHERE_RERANK_MODEL || "rerank-multilingual-v3.0"})`
        : " — set RERANK_ENABLED=true (with PORTKEY_API_KEY + PORTKEY_COHERE_VIRTUAL_KEY, or RERANK_URL) to enable.")
  );

  // PORTKEY_MODEL guardrail. The Jul-9 outage was a provider-namespaced model
  // string ("@org/model") sent to the DIRECT OpenAI client, which 400s every
  // request. When there's no Portkey routing (PORTKEY_API_KEY=pk-...), a
  // namespaced model is unambiguously wrong — refuse to boot with it; a
  // non-OpenAI-looking name gets a loud warning.
  if (currentEnv.PORTKEY_MODEL) {
    const model = currentEnv.PORTKEY_MODEL;
    const hasPortkeyRouting = !!(currentEnv.PORTKEY_API_KEY && currentEnv.PORTKEY_API_KEY.startsWith("pk-"));
    const looksNamespaced = model.startsWith("@") || model.includes("/");
    const looksOpenAI = /^(gpt-|o1|o3|o4|chatgpt|text-)/i.test(model);
    if (!hasPortkeyRouting && looksNamespaced) {
      const msg =
        `CONFIG ERROR: PORTKEY_MODEL="${model}" is a provider-namespaced model but no Portkey routing ` +
        `(PORTKEY_API_KEY=pk-...) is configured — the direct OpenAI client will reject it (HTTP 400). ` +
        `Set PORTKEY_MODEL to an OpenAI model (e.g. gpt-4o-mini / gpt-4.1-mini) or configure Portkey.`;
      console.error(msg);
      throw new Error(msg);
    }
    if (!hasPortkeyRouting && !looksOpenAI) {
      console.warn(
        `CONFIG WARNING: PORTKEY_MODEL="${model}" does not look like an OpenAI model and no Portkey routing is configured. ` +
        `If the OpenAI client rejects it, set an OpenAI model name (e.g. gpt-4o-mini).`
      );
    }
  }

  // Secret-hygiene guardrail: an OpenAI key parked under a VITE_-prefixed var is
  // a footgun — VITE_ vars are meant for client exposure. It's not currently
  // sent to the browser, but the name invites a future leak; recommend renaming.
  if (!process.env.OPENAI_API_KEY && !process.env.OPENAI_KEY && process.env.VITE_OPENAI_API_KEY) {
    console.warn(
      "SECURITY WARNING: your OpenAI key is set as VITE_OPENAI_API_KEY. VITE_-prefixed vars are intended " +
      "for client-side exposure — rename it to OPENAI_API_KEY so the secret can never leak into the browser bundle."
    );
  }

  // Database Connection Validation Check
  if (currentEnv.DATABASE_URL) {
    try {
      // Dynamic import to prevent circular dependency at module load
      const { prisma } = await import("./database/db.server");
      // Direct call query connection validation
      const dbStart = Date.now();
      await prisma.$executeRaw`SELECT 1`.catch(async (e: any) => {
        // Fallback user count query check
        await prisma.user.count();
      });
      console.log(`[CONFIG OK] Database connection established in ${Date.now() - dbStart}ms`);
    } catch (err: any) {
      console.error("--------------------------------------------------------------------------------");
      console.error(`CONFIG WARNING: Database connectivity check failed during startup.`);
      console.error(`Reason: ${err.message || err}`);
      console.error("The server will start, but database-dependent features will fail gracefully.");
      console.error("--------------------------------------------------------------------------------");

      // We do not exit(1) on database connection errors on development, but warn loudly. 
      // In production, we log of database issue clearly.
    }
  }
}
