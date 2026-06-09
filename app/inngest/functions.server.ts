import { inngest } from "./client.server";
import { prisma } from "~/database/db.server";
import {
  crawlUrl,
  chunkText,
  getYoutubeTranscript,
  detectYouTubeUrlType,
  extractPlaylistId,
  extractChannelHandle,
  getPlaylistVideos,
  getChannelVideos,
  getVideoTitle,
} from "~/ai-layer/crawler.server";
import { upsertChunks } from "~/ai-layer/ai.server";

// ─── event payload types ────────────────────────────────────────────────────
interface WebSingleData { sourceId?: string; url: string; projectId: string }
interface WebBatchData { projectId: string; sources: Array<{ sourceId: string; url: string }> }
interface SourceData { sourceId: string; projectId: string }
interface YoutubeData { projectId: string; videoUrl: string }
interface NotionData { projectId: string }
interface ProjectSyncData { projectId: string }

// ─── 1. Single URL ─────────────────────────────────────────────────────────────
export const ingestWebSingle = inngest.createFunction(
  {
    id: "ingest-web-single",
    triggers: [{ event: "sitegist/ingest.web.single" }],
    retries: 3,
    concurrency: { limit: 5, key: "event.data.projectId" },
  },
  async ({ event, step }: { event: { data: WebSingleData }; step: any }) => {
    const { sourceId, url, projectId } = event.data;

    const crawled = await step.run("crawl", () => crawlUrl(url)) as Awaited<ReturnType<typeof crawlUrl>>;

    if (!crawled?.content) {
      if (sourceId) {
        await step.run("mark-error", () =>
          prisma.knowledgeSource.update({
            where: { id: sourceId },
            data: { indexingStatus: "ERROR", indexingError: "Could not crawl URL" },
          })
        );
      }
      return { success: false, reason: "crawl_failed" };
    }

    const saved = await step.run("save-to-db", async () => {
      if (sourceId) {
        return prisma.knowledgeSource.update({
          where: { id: sourceId },
          data: {
            title: crawled.title || url,
            content: crawled.content,
            indexingStatus: "PROCESSING",
            indexingError: null,
          },
        });
      }
      const existing = await prisma.knowledgeSource.findFirst({
        where: { projectId, source: url, type: "web" },
      });
      if (existing) {
        return prisma.knowledgeSource.update({
          where: { id: existing.id },
          data: {
            title: crawled.title || url,
            content: crawled.content,
            indexingStatus: "PROCESSING",
            indexingError: null,
          },
        });
      }
      return prisma.knowledgeSource.create({
        data: {
          projectId,
          type: "web",
          source: url,
          title: crawled.title || url,
          content: crawled.content,
          indexingStatus: "PROCESSING",
        },
      });
    }) as { id: string };

    await step.run("embed", () => {
      const chunks = chunkText(crawled.content!);
      return upsertChunks(
        projectId,
        chunks.map((c: string) => ({ text: c, metadata: { url, title: crawled.title || url } }))
      );
    });

    await step.run("mark-indexed", () =>
      prisma.knowledgeSource.update({
        where: { id: saved.id },
        data: { indexingStatus: "INDEXED", indexedAt: new Date(), indexingError: null },
      })
    );

    return { success: true, sourceId: saved.id };
  }
);

// ─── 2. Web Batch (no page cap) ────────────────────────────────────────────────
export const ingestWebBatch = inngest.createFunction(
  {
    id: "ingest-web-batch",
    triggers: [{ event: "sitegist/ingest.web.batch" }],
    retries: 2,
  },
  async ({ event, step }: { event: { data: WebBatchData }; step: any }) => {
    const { sources, projectId } = event.data;

    await step.sendEvent(
      "fan-out-crawls",
      sources.map((s: { sourceId: string; url: string }) => ({
        name: "sitegist/ingest.web.single" as const,
        data: { sourceId: s.sourceId, url: s.url, projectId },
      }))
    );

    return { queued: sources.length };
  }
);

// ─── 3. Source embed-only (text, file, notion) ─────────────────────────────────
export const ingestSource = inngest.createFunction(
  {
    id: "ingest-source",
    triggers: [{ event: "sitegist/ingest.source" }],
    retries: 3,
    concurrency: { limit: 10, key: "event.data.projectId" },
  },
  async ({ event, step }: { event: { data: SourceData }; step: any }) => {
    const { sourceId, projectId } = event.data;

    const source = await step.run("load-source", () =>
      prisma.knowledgeSource.findUnique({ where: { id: sourceId } })
    ) as { id: string; content: string | null; title: string | null; source: string } | null;

    if (!source?.content) {
      await step.run("mark-error", () =>
        prisma.knowledgeSource.update({
          where: { id: sourceId },
          data: { indexingStatus: "ERROR", indexingError: "No content to index" },
        })
      );
      return { success: false };
    }

    await step.run("mark-processing", () =>
      prisma.knowledgeSource.update({
        where: { id: sourceId },
        data: { indexingStatus: "PROCESSING" },
      })
    );

    await step.run("embed", () => {
      const chunks = chunkText(source.content!);
      return upsertChunks(
        projectId,
        chunks.map((c: string) => ({
          text: c,
          metadata: { title: source.title || source.source, source: source.source },
        }))
      );
    });

    await step.run("mark-indexed", () =>
      prisma.knowledgeSource.update({
        where: { id: sourceId },
        data: { indexingStatus: "INDEXED", indexedAt: new Date(), indexingError: null },
      })
    );

    return { success: true };
  }
);

// ─── 4. YouTube (no video cap) ─────────────────────────────────────────────────
export const ingestYoutube = inngest.createFunction(
  {
    id: "ingest-youtube",
    triggers: [{ event: "sitegist/ingest.youtube" }],
    retries: 2,
    timeouts: { finish: "2h" },
  },
  async ({ event, step }: { event: { data: YoutubeData }; step: any }) => {
    const { projectId, videoUrl } = event.data;
    const urlType = detectYouTubeUrlType(videoUrl);

    const videos = await step.run("resolve-videos", async () => {
      if (urlType === "playlist") {
        const playlistId = extractPlaylistId(videoUrl);
        if (!playlistId) throw new Error("Could not extract playlist ID");
        return getPlaylistVideos(playlistId, 500);
      }
      if (urlType === "channel") {
        const handle = extractChannelHandle(videoUrl);
        if (!handle) throw new Error("Could not extract channel handle");
        return getChannelVideos(handle, 500);
      }
      const match = videoUrl.match(/(?:v=|youtu\.be\/)([^&\s]+)/);
      const id = match?.[1] ?? videoUrl;
      const title = await getVideoTitle(id);
      return [{ id, title }];
    }) as Array<{ id: string; title: string }>;

    let imported = 0;

    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      const canonicalUrl = `https://www.youtube.com/watch?v=${video.id}`;

      const result = await step.run(`process-video-${i}`, async () => {
        const existing = await prisma.knowledgeSource.findFirst({
          where: { projectId, source: canonicalUrl },
        });
        if (existing) return { skipped: true };

        const transcript = await getYoutubeTranscript(canonicalUrl);
        if (!transcript) return { skipped: true, reason: "no_transcript" };

        const src = await prisma.knowledgeSource.create({
          data: {
            projectId,
            type: "youtube",
            source: canonicalUrl,
            title: video.title || `YouTube Video (${video.id})`,
            content: transcript,
            indexingStatus: "PROCESSING",
          },
        });

        const chunks = chunkText(transcript);
        await upsertChunks(
          projectId,
          chunks.map((c: string) => ({
            text: c,
            metadata: { title: video.title || "YouTube Video", source: canonicalUrl },
          }))
        );

        await prisma.knowledgeSource.update({
          where: { id: src.id },
          data: { indexingStatus: "INDEXED", indexedAt: new Date() },
        });

        return { imported: true };
      }) as { skipped?: boolean; imported?: boolean };

      if (result.imported) imported++;
    }

    return { total: videos.length, imported };
  }
);

// ─── 5. Notion sync ───────────────────────────────────────────────────────────
export const ingestNotion = inngest.createFunction(
  {
    id: "ingest-notion",
    triggers: [{ event: "sitegist/ingest.notion" }],
    retries: 2,
  },
  async ({ event, step }: { event: { data: NotionData }; step: any }) => {
    const { projectId } = event.data;

    await step.run("sync", async () => {
      const { syncNotion } = await import("~/backend/integrations.server");
      await syncNotion(projectId);
    });

    return { success: true };
  }
);

// ─── 6. Project sync (re-index all web + integrations) ────────────────────────
export const ingestProjectSync = inngest.createFunction(
  {
    id: "ingest-project-sync",
    triggers: [{ event: "sitegist/ingest.project.sync" }],
    retries: 1,
  },
  async ({ event, step }: { event: { data: ProjectSyncData }; step: any }) => {
    const { projectId } = event.data;

    const project = await step.run("load-project", () =>
      prisma.project.findUnique({
        where: { id: projectId },
        include: { knowledgeSources: true, integrations: true },
      })
    ) as { knowledgeSources: Array<{ id: string; type: string; source: string }>; integrations: Array<{ provider: string }> } | null;

    if (!project) return { success: false };

    const webSources = project.knowledgeSources.filter((s) => s.type === "web");

    if (webSources.length > 0) {
      await step.sendEvent(
        "fan-out-web-recrawl",
        webSources.map((s) => ({
          name: "sitegist/ingest.web.single" as const,
          data: { sourceId: s.id, url: s.source, projectId },
        }))
      );
    }

    const hasNotion = project.integrations.some((i) => i.provider === "notion");
    if (hasNotion) {
      await step.sendEvent("trigger-notion-sync", {
        name: "sitegist/ingest.notion" as const,
        data: { projectId },
      });
    }

    await step.run("update-project-timestamp", () =>
      prisma.project.update({ where: { id: projectId }, data: { updatedAt: new Date() } })
    );

    return { recrawled: webSources.length, notion: hasNotion };
  }
);

// ─── 7. Daily cron (replaces setTimeout loop in sync-job.server.ts) ───────────
export const dailySyncCron = inngest.createFunction(
  {
    id: "daily-sync-cron",
    triggers: [{ cron: "0 0 * * *" }],
    retries: 1,
  },
  async ({ step }: { step: any }) => {
    const projects = await step.run("load-projects", () =>
      prisma.project.findMany({
        select: { id: true, name: true, settings: true, updatedAt: true },
      })
    ) as Array<{ id: string; name: string; settings: unknown; updatedAt: Date }>;

    const now = Date.now();
    const thresholds: Record<string, number> = {
      Daily: 24 * 60 * 60 * 1000,
      Weekly: 7 * 24 * 60 * 60 * 1000,
      Monthly: 30 * 24 * 60 * 60 * 1000,
    };

    const due = projects.filter((p) => {
      const settings = (p.settings as Record<string, unknown>) || {};
      const freq = (settings.syncFrequency as string) || "Daily";
      if (freq === "Manual") return false;
      const threshold = thresholds[freq] ?? thresholds.Daily;
      return now - new Date(p.updatedAt).getTime() >= threshold;
    });

    if (due.length === 0) return { synced: 0 };

    await step.sendEvent(
      "fan-out-project-syncs",
      due.map((p) => ({
        name: "sitegist/ingest.project.sync" as const,
        data: { projectId: p.id },
      }))
    );

    return { synced: due.length };
  }
);

export const functions = [
  ingestWebSingle,
  ingestWebBatch,
  ingestSource,
  ingestYoutube,
  ingestNotion,
  ingestProjectSync,
  dailySyncCron,
];
