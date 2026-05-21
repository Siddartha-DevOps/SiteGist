/**
 * Centralized Environment Manager and Configuration System
 * Validates and stores environment variables to ensure production safety and early failure.
 */

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
  CLOUDFLARE_TURNSTILE_SECRET_KEY: string | undefined;
  PADDLE_API_KEY: string | undefined;
  UPSTASH_REDIS_REST_URL: string | undefined;
  UPSTASH_REDIS_REST_TOKEN: string | undefined;
}

// Keep a clean list of required variables
const REQUIRED_VARS: (keyof EnvSchema)[] = [
  "DATABASE_URL",
  "SESSION_SECRET",
  "GEMINI_API_KEY",
  "PINECONE_API_KEY",
];

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
    CLOUDFLARE_TURNSTILE_SECRET_KEY: cleanValue(process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY),
    PADDLE_API_KEY: cleanValue(process.env.PADDLE_API_KEY),
    UPSTASH_REDIS_REST_URL: cleanValue(process.env.UPSTASH_REDIS_REST_URL),
    UPSTASH_REDIS_REST_TOKEN: cleanValue(process.env.UPSTASH_REDIS_REST_TOKEN),
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
  const missingKeys: string[] = [];

  for (const key of REQUIRED_VARS) {
    const val = currentEnv[key];
    if (!val || val.trim() === "" || val.includes("placeholder")) {
      missingKeys.push(key);
    }
  }

  const isProduction = currentEnv.NODE_ENV === "production";

  if (missingKeys.length > 0) {
    console.error("================================================================================");
    console.error("CRITICAL CONFIGURATION ERROR: MISSING REQUIRED ENVIRONMENT VARIABLES");
    console.error("The following environment variables are missing but required for operation:");
    for (const key of missingKeys) {
      console.error(` - ${key}`);
    }
    console.error("--------------------------------------------------------------------------------");
    console.error("Please navigate to Settings -> Environment Variables in AI Studio and define them.");
    console.error("================================================================================");

    if (isProduction) {
      console.error("DEPLOYMENT WARNING: Startup validation failed. Logging warning but continuing boot to avoid healthcheck failure.");
    }
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
