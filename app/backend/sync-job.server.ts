import { prisma } from "~/database/db.server";
import { syncNotion, syncGoogleDrive } from "./integrations.server";
import { crawlUrl, chunkText } from "~/ai-layer/crawler.server";
import { upsertChunks } from "~/ai-layer/ai.server";

/**
 * Performs a comprehensive synchronization of all knowledge sources for a single project.
 * This includes web crawler recrawls, Notion content fetching, and file updates.
 */
export async function syncProjectSources(projectId: string) {
  console.log(`[Sync Job] Beginning full sync for project: ${projectId}`);
  
  // 1. Fetch project with all its knowledge sources
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { knowledgeSources: true, integrations: true }
  });
  
  if (!project) {
    console.error(`[Sync Job] Project not found: ${projectId}`);
    return;
  }
  
  // 2. Loop through and sync WEB knowledge sources (recrawl)
  const webSources = project.knowledgeSources.filter(source => source.type === "web");
  for (const source of webSources) {
    try {
      console.log(`[Sync Job] Recrawling web source URL: ${source.source}`);
      const crawled = await crawlUrl(source.source);
      if (crawled && crawled.content) {
        // Save back to db
        await prisma.knowledgeSource.update({
          where: { id: source.id },
          data: {
            title: crawled.title || source.title,
            content: crawled.content,
            updatedAt: new Date()
          }
        });
        
        // Chunk and upsert to Pinecone
        const chunks = chunkText(crawled.content);
        await upsertChunks(projectId, chunks.map(c => ({
          text: c,
          metadata: { url: source.source, title: crawled.title || source.title, type: "web" }
        })));
        console.log(`[Sync Job] Successfully recrawled and embedded: ${source.source}`);
      }
    } catch (err) {
      console.error(`[Sync Job] Failed to recrawl web source ${source.source}:`, err);
    }
  }
  
  // 3. Sync Notion integrations if present
  const notionIntegration = project.integrations.find(i => i.provider === "notion");
  if (notionIntegration) {
    try {
      console.log(`[Sync Job] Syncing connected Notion integration...`);
      await syncNotion(projectId);
      console.log(`[Sync Job] Successfully completed Notion sync.`);
    } catch (err) {
      console.error(`[Sync Job] Failed Notion integration sync:`, err);
    }
  }
  
  // 4. Sync Google Drive integrations if present
  const googleIntegration = project.integrations.find(i => i.provider === "google_drive");
  if (googleIntegration) {
    try {
      console.log(`[Sync Job] Syncing connected Google Drive integration...`);
      await syncGoogleDrive(projectId);
      console.log(`[Sync Job] Successfully completed Google Drive sync.`);
    } catch (err) {
      console.error(`[Sync Job] Failed Google Drive integration sync:`, err);
    }
  }

  // 5. Update project updatedAt timestamp
  await prisma.project.update({
    where: { id: projectId },
    data: { updatedAt: new Date() }
  });
  
  console.log(`[Sync Job] Completed full sync for project: ${projectId}`);
}

export async function syncAllProjects() {
  console.log("[Sync Job] Starting global synchronization...");
  const projects = await prisma.project.findMany({
    select: { id: true, name: true, settings: true, updatedAt: true }
  });

  const now = Date.now();
  for (const project of projects) {
    const settings = (project.settings as any) || {};
    const frequency: string = settings.syncFrequency || "Daily";
    if (frequency === "Manual") {
      console.log(`[Sync Job] Skipping ${project.name} — Manual Only`);
      continue;
    }
    const thresholds: Record<string, number> = {
      Daily:   24 * 60 * 60 * 1000,
      Weekly:   7 * 24 * 60 * 60 * 1000,
      Monthly: 30 * 24 * 60 * 60 * 1000,
    };
    const threshold = thresholds[frequency] ?? thresholds.Daily;
    const lastSync = project.updatedAt.getTime();
    if (now - lastSync < threshold) {
      console.log(`[Sync Job] Skipping ${project.name} — synced ${Math.round((now - lastSync) / 3600000)}h ago, threshold is ${frequency}`);
      continue;
    }

    console.log(`[Sync Job] Syncing ${project.name} (${frequency})`);
    try {
      await syncProjectSources(project.id);
    } catch (error) {
      console.error(`[Sync Job] Global sync loop failed for project ${project.id}:`, error);
    }
  }
  console.log("[Sync Job] Global synchronization complete.");
}

// Scheduled sync is now handled by the Inngest dailySyncCron function (app/inngest/functions.server.ts).
// This stub remains for backward compatibility with any callers.
export function startBackgroundSync() {
  console.log("[Sync Job] Background sync delegated to Inngest cron — no-op in process.");
}

