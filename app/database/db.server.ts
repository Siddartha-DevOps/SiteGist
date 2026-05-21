import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";
import fs from "fs";
import path from "path";

/**
 * Prisma Client singleton.
 * Using a singleton pattern ensures we don't exhaust database connections
 * during development hot reloads.
 */

let _cachedDb: any = null;
let _usingFallback = false;

function getClient(useFallback = false): any {
  // Load connection details directly from local .env to bypass any stale platform variables
  try {
    const envPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf-8");
      const dbUrlMatch = envContent.match(/DATABASE_URL\s*=\s*(['\"]?)(.*?)\1(?:[\r\n]|$)/);
      if (dbUrlMatch && dbUrlMatch[2]) {
        const localUrl = dbUrlMatch[2].trim();
        if (localUrl) {
          process.env.DATABASE_URL = localUrl;
        }
      }
      const directUrlMatch = envContent.match(/DIRECT_DATABASE_URL\s*=\s*(['\"]?)(.*?)\1(?:[\r\n]|$)/);
      if (directUrlMatch && directUrlMatch[2]) {
        const localDirectUrl = directUrlMatch[2].trim();
        if (localDirectUrl) {
          process.env.DIRECT_DATABASE_URL = localDirectUrl;
        }
      }
    }
  } catch (err) {
    console.warn("[Prisma Config] Local .env parsing failed or not found, using system variables:", err);
  }

  let url = process.env.DATABASE_URL || "";
  
  if (useFallback && process.env.DIRECT_DATABASE_URL) {
    console.log("[Prisma Client] Forcing failover direct connection using DIRECT_DATABASE_URL.");
    url = process.env.DIRECT_DATABASE_URL;
  }
  
  if (!url || url.trim() === "") {
    if (process.env.DIRECT_DATABASE_URL) {
      console.log("[Prisma Client] DATABASE_URL is empty. Falling back to DIRECT_DATABASE_URL immediately.");
      url = process.env.DIRECT_DATABASE_URL;
    } else {
      console.error("--------------------------------------------------------------------------------");
      console.error("CRITICAL WARNING: DATABASE_URL is missing or empty.");
      console.error("The application will not be able to connect to the database.");
      console.error("Please add DATABASE_URL to your environment variables in AI Studio settings.");
      console.error("Using a temporary placeholder connection string to prevent process crash-looping during boot.");
      console.error("--------------------------------------------------------------------------------");
      
      // Set a placeholder so Prisma can initialize without throwing a module-load exception
      url = "postgresql://placeholder_user:placeholder_pass@127.0.0.1:5432/placeholder_db";
    }
  }

  // Clean up quotes if present
  if (url.startsWith('"') && url.endsWith('"')) {
    url = url.slice(1, -1);
  } else if (url.startsWith("'") && url.endsWith("'")) {
    url = url.slice(1, -1);
  }
  
  const rawClient = new PrismaClient({
    datasourceUrl: url,
    log: [
      { level: "error", emit: "stdout" },
    ],
  });

  const isAccelerate = url.startsWith("prisma");
  const rawExtended = isAccelerate ? rawClient.$extends(withAccelerate()) : rawClient;

  // Intercept operations and implement robust automatic failover query retry
  const client = rawExtended.$extends({
    query: {
      async $allOperations({ model, operation, args, query }) {
        const maxAttempts = 3;
        let attempt = 0;
        
        while (attempt < maxAttempts) {
          attempt++;
          try {
            return await query(args);
          } catch (err: any) {
            const errMsg = err.message || "";
            
            // Check for API key / Accelerate errors
            const isKeyError = errMsg.includes("P6002") || 
                               errMsg.includes("API key is invalid") || 
                               (errMsg.includes("Unauthorized") && errMsg.toLowerCase().includes("accelerate"));
            
            if (isKeyError && process.env.DIRECT_DATABASE_URL && !useFallback && !_usingFallback) {
              console.error("================================================================================");
              console.error("[Prisma Failover] Active connection failed due to Prisma Accelerate API Key verification.");
              console.error("[Prisma Failover] Swapping active instances and falling back to DIRECT_DATABASE_URL...");
              console.error("================================================================================");
              
              _usingFallback = true;
              _cachedDb = getClient(true);
              
              // Re-bind to the correct model and run the query directly
              if (model) {
                const fallbackDelegate = _cachedDb[model];
                if (fallbackDelegate && typeof fallbackDelegate[operation] === "function") {
                  return await fallbackDelegate[operation](args);
                }
              }
            }
            
            // Check for transient socket resets, connection drops, or Peer Connection Resets (e.g., Os { code: 104, kind: ConnectionReset })
            const isTransientError = 
              errMsg.includes("ConnectionReset") ||
              errMsg.includes("Connection reset") ||
              errMsg.includes("104") ||
              errMsg.includes("Io") ||
              errMsg.includes("ECONNRESET") ||
              errMsg.includes("socket hang up") ||
              errMsg.includes("EPIPE") ||
              errMsg.includes("ETIMEDOUT") ||
              errMsg.includes("P1017") || 
              errMsg.includes("closed by peer") ||
              errMsg.toLowerCase().includes("connection reset") ||
              errMsg.toLowerCase().includes("can't reach database");
              
            if (isTransientError && attempt < maxAttempts) {
              const backoffMs = attempt * 150;
              console.warn(`[Prisma Retry] Transient database error detected (Attempt ${attempt}/${maxAttempts}). Retrying in ${backoffMs}ms... Error: ${errMsg.substring(0, 150)}`);
              await new Promise((resolve) => setTimeout(resolve, backoffMs));
              continue;
            }
            
            throw err;
          }
        }
        // Fallback return if loop somehow finishes without throwing (TypeScript safety)
        throw new Error("Query failed after multiple database connection retries.");
      }
    }
  });

  // Optional: check connection early
  // @ts-ignore
  if (client.$connect) {
    // @ts-ignore
    client.$connect().catch((err: any) => {
      const errorMsg = err.message || "";
      if (errorMsg.includes("P6002")) {
        console.error("--------------------------------------------------------------------------------");
        console.error("CRITICAL DATABASE AUTHENTICATION ERROR (P6002)");
        console.error("Your Prisma Accelerate API Key is invalid.");
        console.error("1. Visit the Prisma Data Platform (https://console.prisma.io)");
        console.error("2. Regenerate your Accelerate Connection String.");
        console.error("3. Update your DATABASE_URL in the Settings menu of this app.");
        console.error("Current URL starts with:", url.substring(0, 15) + "...");
        console.error("--------------------------------------------------------------------------------");
      } else {
        console.error("DB Connection Error:", errorMsg);
      }
    });
  }

  return client as any;
}

type ExtendedPrismaClient = PrismaClient;

declare global {
  // eslint-disable-next-line no-var
  var __db__: ExtendedPrismaClient | undefined;
}

function getPrisma() {
  if (process.env.NODE_ENV === "production") {
    if (_usingFallback) {
      if (!_cachedDb) {
        _cachedDb = getClient(true);
      }
      return _cachedDb;
    }
    if (!_cachedDb) {
      _cachedDb = getClient(false);
    }
    return _cachedDb;
  }
  
  if (global.__db__) return global.__db__;
  
  const client = getClient(false);
  global.__db__ = client;
  return client;
}

const prisma = new Proxy({} as ExtendedPrismaClient, {
  get(target, prop) {
    const client = getPrisma();
    const val = Reflect.get(client, prop);
    return typeof val === "function" ? val.bind(client) : val;
  },
});

export { prisma };
