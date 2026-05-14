import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

/**
 * Prisma Client singleton.
 * Using a singleton pattern ensures we don't exhaust database connections
 * during development hot reloads.
 */

function getClient() {
  let url = process.env.DATABASE_URL || "";
  
  // Clean up quotes if present
  if (url.startsWith('"') && url.endsWith('"')) {
    url = url.slice(1, -1);
  } else if (url.startsWith("'") && url.endsWith("'")) {
    url = url.slice(1, -1);
  }
  
  // Set the environment variable back so Prisma sees the cleaned version
  process.env.DATABASE_URL = url;

  const client = new PrismaClient({
    datasourceUrl: url,
    log: [
      { level: "error", emit: "stdout" },
    ],
  }).$extends(withAccelerate());

  // Optional: check connection early
  // Note: with extensions, $connect is not directly on the extended client in the same way,
  // but we can still use it or just try a query.
  // @ts-ignore
  client.$connect?.().catch((err: any) => {
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

  // Start background sync job (Notion/Drive)
  // Temporarily disabled to debug black screen/ERR_CONNECTION_CLOSED
  // import("~/backend/sync-job.server").then(m => m.startBackgroundSync()).catch(e => console.error("Failed to start sync job:", e));

  return client;
}

type ExtendedPrismaClient = ReturnType<typeof getClient>;

declare global {
  // eslint-disable-next-line no-var
  var __db__: ExtendedPrismaClient | undefined;
}

let prisma: ExtendedPrismaClient;

if (process.env.NODE_ENV === "production") {
  prisma = getClient();
} else {
  if (!global.__db__) {
    global.__db__ = getClient();
  }
  prisma = global.__db__;
}

export { prisma };
