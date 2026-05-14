import { prisma } from "~/database/db.server";
import { syncNotion, syncGoogleDrive } from "./integrations.server";

export async function syncAllProjects() {
  console.log("[Sync Job] Starting global synchronization...");
  const projects = await prisma.project.findMany({
    include: { integrations: true }
  });

  for (const project of projects) {
    console.log(`[Sync Job] Syncing project: ${project.name} (${project.id})`);
    for (const integration of project.integrations) {
      try {
        if (integration.provider === "notion") {
          await syncNotion(project.id);
          console.log(`[Sync Job] Successfully synced Notion for ${project.id}`);
        } else if (integration.provider === "google_drive") {
          await syncGoogleDrive(project.id);
          console.log(`[Sync Job] Successfully synced Google Drive for ${project.id}`);
        }
      } catch (error) {
        console.error(`[Sync Job] Failed to sync ${integration.provider} for ${project.id}:`, error);
      }
    }
  }
  console.log("[Sync Job] Global synchronization complete.");
}

// Simple background loop (best effort for container environment)
let isLoopRunning = false;
export function startBackgroundSync() {
  if (isLoopRunning) return;
  isLoopRunning = true;
  
  const INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  
  console.log("[Sync Job] Background sync scheduler started. Interval: 24h");
  
  const run = async () => {
    try {
      await syncAllProjects();
    } catch (e) {
      console.error("[Sync Job] Error in sync loop:", e);
    }
    setTimeout(run, INTERVAL);
  };
  
  // Initial delay or immediate run? 
  // Let's run after a short delay to not block startup
  setTimeout(run, 60000); 
}
