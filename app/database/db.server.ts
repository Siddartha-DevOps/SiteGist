import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

/**
 * Prisma Client singleton.
 * Using a singleton pattern ensures we don't exhaust database connections
 * during development hot reloads.
 */

function getClient() {
  let url = process.env.DATABASE_URL || "";
  
  if (!url || url.trim() === "") {
    console.error("--------------------------------------------------------------------------------");
    console.error("CRITICAL WARNING: DATABASE_URL is missing or empty.");
    console.error("The application will not be able to connect to the database.");
    console.error("Please add DATABASE_URL to your environment variables in AI Studio settings.");
    console.error("Using a temporary placeholder connection string to prevent process crash-looping during boot.");
    console.error("--------------------------------------------------------------------------------");
    
    // Set a placeholder so Prisma can initialize without throwing a module-load exception
    url = "postgresql://placeholder_user:placeholder_pass@127.0.0.1:5432/placeholder_db";
  }

  // Clean up quotes if present
  if (url.startsWith('"') && url.endsWith('"')) {
    url = url.slice(1, -1);
  } else if (url.startsWith("'") && url.endsWith("'")) {
    url = url.slice(1, -1);
  }
  
  // Set the environment variable back so Prisma sees the cleaned version
  process.env.DATABASE_URL = url;

  const rawClient = new PrismaClient({
    datasourceUrl: url,
    log: [
      { level: "error", emit: "stdout" },
    ],
  });

  const isAccelerate = url.startsWith("prisma");
  const client = isAccelerate ? rawClient.$extends(withAccelerate()) : rawClient;

  // Optional: check connection early
  // Note: with extensions, $connect is not directly on the extended client in the same way,
  // but we can still use it or just try a query.
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

  // Start background sync job (Notion/Drive)
  // Temporarily disabled to debug black screen/ERR_CONNECTION_CLOSED
  // import("~/backend/sync-job.server").then(m => m.startBackgroundSync()).catch(e => console.error("Failed to start sync job:", e));

  return client as any;
}

type ExtendedPrismaClient = PrismaClient;

declare global {
  // eslint-disable-next-line no-var
  var __db__: ExtendedPrismaClient | undefined;
}

let _cachedProductionDb: ExtendedPrismaClient | null = null;

function getPrisma() {
  if (process.env.NODE_ENV === "production") {
    if (!_cachedProductionDb) {
      _cachedProductionDb = getClient();
    }
    return _cachedProductionDb;
  }
  
  if (global.__db__) return global.__db__;
  
  const client = getClient();
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
