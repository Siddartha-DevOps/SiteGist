/**
 * Async ingestion core.
 *
 * `ingestKnowledgeSource` is the single, reusable unit of work for turning one
 * KnowledgeSource into vectors: resolve content (crawl / transcript / stored) →
 * chunk (token-based) → batched embed → upsert → update status/progress. It is
 * called by the Inngest durable function (production async path) and by the
 * inline fallback, so behaviour is identical either way.
 *
 * State machine: queued → crawling → embedding → indexed | failed.
 * Incremental sync: if the freshly-resolved content hashes to the same value as
 * the last successful index, embedding is skipped entirely.
 */
import crypto from "crypto";
import { prisma } from "~/database/db.server";
import { crawlUrl, getYoutubeTranscript } from "~/ai-layer/crawler.server";
import { chunkTextByTokens } from "~/ai-layer/chunking.server";
import { upsertChunksBatched, deleteSourceChunks } from "~/ai-layer/ai.server";
import { inngest, INGEST_SOURCE_EVENT } from "~/inngest/client";
import { log, startTimer } from "~/lib/logger.server";
import { captureException } from "~/lib/monitoring.server";

export type IngestResult = { sourceId: string; chunks: number; upserted: number; skipped: boolean };

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

/**
 * Async ingestion is used only when explicitly opted in via INGEST_ASYNC=1 AND
 * Inngest is configured. Merely having INNGEST_EVENT_KEY present is NOT enough:
 * if the Inngest app isn't synced to /api/inngest (or the signing key is missing),
 * events are accepted but never processed, leaving every source stuck in "queued".
 * Defaulting to the inline path makes ingestion work reliably out of the box;
 * flip INGEST_ASYNC=1 once Inngest is fully wired and verified for scale.
 */
export function isAsyncIngestionEnabled(): boolean {
  if (process.env.INGEST_ASYNC?.trim() !== "1") return false;
  return !!(process.env.INNGEST_EVENT_KEY?.trim() || process.env.INNGEST_DEV?.trim());
}

/**
 * Enqueue a source for (re)indexing. Sends an Inngest event when async ingestion
 * is enabled; otherwise runs inline (awaited) so existing deployments keep working
 * exactly as before until Inngest is configured.
 */
export async function enqueueSourceIngestion(projectId: string, sourceId: string): Promise<void> {
  if (isAsyncIngestionEnabled()) {
    await inngest.send({ name: INGEST_SOURCE_EVENT, data: { projectId, sourceId } });
    return;
  }
  try {
    await ingestKnowledgeSource(sourceId);
  } catch (err) {
    console.error(`[Ingestion] Inline fallback failed for source ${sourceId}:`, err);
  }
}

/** Enqueue many sources at once (fan-out). */
export async function enqueueManySourceIngestions(
  items: { projectId: string; sourceId: string }[],
  opts: { maxInline?: number } = {}
): Promise<void> {
  if (items.length === 0) return;
  if (isAsyncIngestionEnabled()) {
    await inngest.send(items.map(i => ({ name: INGEST_SOURCE_EVENT, data: i })));
    return;
  }
  // Inline mode: process up to `maxInline` now for instant feedback; the rest stay
  // "queued" for the client-driven drain (/api/ingest/drain) to pick up. This keeps
  // large batches (e.g. a whole sitemap) from blocking/timing-out a single request.
  // Background callers (scheduled sync) omit maxInline to process everything.
  const limit = opts.maxInline ?? items.length;
  for (let i = 0; i < items.length && i < limit; i++) {
    try {
      await ingestKnowledgeSource(items[i].sourceId);
    } catch (err) {
      console.error(`[Ingestion] Inline fallback failed for source ${items[i].sourceId}:`, err);
    }
  }
}

/**
 * Process a bounded batch of "queued" sources for a project. Claims each row
 * atomically (queued → crawling) so concurrent drainers never double-process the
 * same source, then ingests the claimed ones. Returns how many it processed and
 * how many remain queued, so a client can keep calling until the queue drains.
 */
export async function drainQueuedSources(projectId: string, batch = 4): Promise<{ processed: number; remaining: number }> {
  const candidates = await prisma.knowledgeSource.findMany({
    where: { projectId, status: "queued" },
    take: batch,
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  const claimed: string[] = [];
  for (const c of candidates) {
    // Atomic claim: only one drainer can flip queued → crawling.
    const res = await prisma.knowledgeSource.updateMany({
      where: { id: c.id, status: "queued" },
      data: { status: "crawling" },
    });
    if (res.count === 1) claimed.push(c.id);
  }

  await Promise.allSettled(claimed.map(id => ingestKnowledgeSource(id)));

  const remaining = await prisma.knowledgeSource.count({ where: { projectId, status: "queued" } });
  return { processed: claimed.length, remaining };
}

async function setStatus(
  sourceId: string,
  status: "queued" | "crawling" | "embedding" | "indexed" | "failed",
  extra: Record<string, any> = {}
) {
  await prisma.knowledgeSource.update({ where: { id: sourceId }, data: { status, ...extra } });
}

/**
 * Resolve, chunk, embed and upsert a single KnowledgeSource. Marks the row
 * crawling → embedding → indexed, or failed (and rethrows so Inngest can retry).
 * Skips embedding when content is unchanged since the last successful index
 * (unless `force` is set, e.g. a manual retry).
 */
export async function ingestKnowledgeSource(
  sourceId: string,
  opts: { force?: boolean } = {}
): Promise<IngestResult> {
  const source = await prisma.knowledgeSource.findUnique({ where: { id: sourceId } });
  if (!source) throw new Error(`KnowledgeSource ${sourceId} not found`);

  const projectId = source.projectId;
  const endTimer = startTimer("ingest.source", { sourceId, projectId, type: source.type });

  try {
    // 1. Resolve content by source type.
    let content = source.content || "";
    let title = source.title || source.source;

    if (source.type === "web") {
      await setStatus(sourceId, "crawling", { error: null });
      const data = await crawlUrl(source.source);
      if (!data || !data.content) {
        throw new Error("Could not crawl or fetch the page. Verify the URL is reachable.");
      }
      content = data.content;
      title = data.title || title;
      await prisma.knowledgeSource.update({ where: { id: sourceId }, data: { content, title } });
    } else if (source.type === "youtube") {
      await setStatus(sourceId, "crawling", { error: null });
      const transcript = await getYoutubeTranscript(source.source);
      if (!transcript) throw new Error("No transcript available (captions may be disabled).");
      content = transcript;
      await prisma.knowledgeSource.update({ where: { id: sourceId }, data: { content } });
    } else if (source.type === "github") {
      await setStatus(sourceId, "crawling", { error: null });
      const res = await fetch(source.source, { headers: { "User-Agent": "SiteGist" } });
      if (!res.ok) throw new Error(`Failed to fetch GitHub file (HTTP ${res.status}).`);
      content = (await res.text()).slice(0, 500_000); // size guard

      await prisma.knowledgeSource.update({ where: { id: sourceId }, data: { content } });
    }
    // 'text' and 'file' already carry their extracted content on the row.

    if (!content.trim()) throw new Error("No content to index for this source.");

    // 2. Incremental sync: skip embedding when content is unchanged.
    const hash = sha256(content);
    if (!opts.force && source.contentHash === hash && source.status === "indexed") {
      await setStatus(sourceId, "indexed", { error: null, lastIndexedAt: new Date() });
      endTimer({ ok: true, skipped: true });
      return { sourceId, chunks: 0, upserted: 0, skipped: true };
    }

    // 3. Token-based chunking.
    const chunks = chunkTextByTokens(content);
    if (chunks.length === 0) throw new Error("Content produced zero chunks.");

    await setStatus(sourceId, "embedding", {
      error: null,
      chunksTotal: chunks.length,
      chunksIndexed: 0,
    });

    // 4. Remove previous vectors for this source (keeps re-crawls clean).
    const sourceKey = source.type === "web" ? source.source : title || source.source;
    try {
      await deleteSourceChunks(projectId, sourceKey);
    } catch (e) {
      console.warn(`[Ingestion] deleteSourceChunks skipped for ${sourceKey}:`, e);
    }

    // 5. Batched embed + upsert with live progress.
    const metaUrl = source.type === "web" || source.type === "youtube" ? source.source : undefined;
    const { upserted } = await upsertChunksBatched(
      projectId,
      chunks.map(c => ({ text: c, metadata: { title, source: sourceKey, ...(metaUrl ? { url: metaUrl } : {}), type: source.type } })),
      {
        onProgress: async (done) => {
          await prisma.knowledgeSource
            .update({ where: { id: sourceId }, data: { chunksIndexed: done } })
            .catch(() => {});
        },
      }
    );

    // 6. Mark indexed and record the content hash for future incremental skips.
    await setStatus(sourceId, "indexed", {
      error: null,
      lastIndexedAt: new Date(),
      contentHash: hash,
      chunksTotal: chunks.length,
      chunksIndexed: chunks.length,
    });
    endTimer({ ok: true, skipped: false, chunks: chunks.length, upserted });
    return { sourceId, chunks: chunks.length, upserted, skipped: false };
  } catch (err: any) {
    const message = err?.message ? String(err.message).slice(0, 1000) : "Ingestion failed";
    await setStatus(sourceId, "failed", { error: message }).catch(() => {});
    captureException(err, { where: "ingestKnowledgeSource", sourceId, projectId, type: source.type });
    endTimer({ ok: false, message });
    throw err;
  }
}
