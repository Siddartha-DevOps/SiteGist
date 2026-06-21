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
  PORTKEY_COHERE_VIRTUAL_KEY: string | undefined;
  COHERE_RERANK_MODEL: string | undefined;
  CLOUDFLARE_TURNSTILE_SECRET_KEY: string | undefined;
  PADDLE_API_KEY: string | undefined;
  UPSTASH_REDIS_REST_URL: string | undefined;
  UPSTASH_REDIS_REST_TOKEN: string | undefined;
  EMBEDDING_PROVIDER: "openai" | "gemini";
}

export const EMBEDDING_PROVIDER = (typeof process !== "undefined" && process.env.EMBEDDING_PROVIDER === "gemini" ? "gemini" : "openai") as "openai" | "gemini";
export const EMBEDDING_DIMENSION = EMBEDDING_PROVIDER === "gemini" ? 768 : 1536;

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
  PORTKEY_COHERE_VIRTUAL_KEY: z.string().optional(),
  COHERE_RERANK_MODEL: z.string().optional(),
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
    PORTKEY_COHERE_VIRTUAL_KEY: cleanValue(process.env.PORTKEY_COHERE_VIRTUAL_KEY),
    COHERE_RERANK_MODEL: cleanValue(process.env.COHERE_RERANK_MODEL),
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

  // Retrieval-quality diagnostic: reranking is the single biggest answer-quality
  // lever and stays silently off until both Portkey keys are present.
  const rerankEnabled = !!(currentEnv.PORTKEY_API_KEY && currentEnv.PORTKEY_COHERE_VIRTUAL_KEY);
  console.log(
    `[CONFIG] Reranking: ${rerankEnabled ? "ENABLED" : "DISABLED"}` +
      (rerankEnabled
        ? ` (model: ${currentEnv.COHERE_RERANK_MODEL || "rerank-multilingual-v3.0"})`
        : " — set PORTKEY_API_KEY + PORTKEY_COHERE_VIRTUAL_KEY to enable Cohere rerank.")
  );

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
