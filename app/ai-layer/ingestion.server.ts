/**
 * Async ingestion core.
 *
 * `ingestKnowledgeSource` is the single, reusable unit of work for turning one
 * KnowledgeSource into vectors: resolve content (crawl / transcript / stored) →
 * chunk → batched embed → upsert → update status. It is called by the Inngest
 * durable function (production async path) and by the inline fallback (used until
 * Inngest is configured), so behaviour is identical either way.
 */
import { prisma } from "~/database/db.server";
import { crawlUrl, chunkText, getYoutubeTranscript } from "~/ai-layer/crawler.server";
import { upsertChunksBatched, deleteSourceChunks } from "~/ai-layer/ai.server";
import { inngest, INGEST_SOURCE_EVENT } from "~/inngest/client";

export type IngestResult = { sourceId: string; chunks: number; upserted: number };

/** Async ingestion is used when Inngest is wired up; otherwise we run inline. */
export function isAsyncIngestionEnabled(): boolean {
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
  // Inline fallback (best-effort). Mirrors the previous synchronous behaviour.
  try {
    await ingestKnowledgeSource(sourceId);
  } catch (err) {
    console.error(`[Ingestion] Inline fallback failed for source ${sourceId}:`, err);
  }
}

/** Enqueue many sources at once (fan-out). */
export async function enqueueManySourceIngestions(
  items: { projectId: string; sourceId: string }[]
): Promise<void> {
  if (items.length === 0) return;
  if (isAsyncIngestionEnabled()) {
    await inngest.send(items.map(i => ({ name: INGEST_SOURCE_EVENT, data: i })));
    return;
  }
  for (const i of items) {
    try {
      await ingestKnowledgeSource(i.sourceId);
    } catch (err) {
      console.error(`[Ingestion] Inline fallback failed for source ${i.sourceId}:`, err);
    }
  }
}

async function setStatus(
  sourceId: string,
  status: "queued" | "processing" | "indexed" | "failed",
  extra: Record<string, any> = {}
) {
  await prisma.knowledgeSource.update({ where: { id: sourceId }, data: { status, ...extra } });
}

/**
 * Resolve, chunk, embed and upsert a single KnowledgeSource. Marks the row
 * processing → indexed, or failed (and rethrows so the caller/Inngest can retry).
 */
export async function ingestKnowledgeSource(sourceId: string): Promise<IngestResult> {
  const source = await prisma.knowledgeSource.findUnique({ where: { id: sourceId } });
  if (!source) throw new Error(`KnowledgeSource ${sourceId} not found`);

  const projectId = source.projectId;

  try {
    await setStatus(sourceId, "processing", { error: null });

    // 1. Resolve content by source type.
    let content = source.content || "";
    let title = source.title || source.source;

    if (source.type === "web") {
      const data = await crawlUrl(source.source);
      if (!data || !data.content) {
        throw new Error("Could not crawl or fetch the page. Verify the URL is reachable.");
      }
      content = data.content;
      title = data.title || title;
      await prisma.knowledgeSource.update({ where: { id: sourceId }, data: { content, title } });
    } else if (source.type === "youtube") {
      const transcript = await getYoutubeTranscript(source.source);
      if (!transcript) throw new Error("No transcript available (captions may be disabled).");
      content = transcript;
      await prisma.knowledgeSource.update({ where: { id: sourceId }, data: { content } });
    }
    // 'text' and 'file' already carry their extracted content on the row.

    if (!content.trim()) throw new Error("No content to index for this source.");

    // 2. Chunk.
    const chunks = chunkText(content);
    if (chunks.length === 0) throw new Error("Content produced zero chunks.");

    // 3. Remove any previous vectors for this source (keeps re-crawls clean).
    const sourceKey = source.type === "web" ? source.source : title || source.source;
    try {
      await deleteSourceChunks(projectId, sourceKey);
    } catch (e) {
      console.warn(`[Ingestion] deleteSourceChunks skipped for ${sourceKey}:`, e);
    }

    // 4. Batched embed + upsert.
    const metaUrl = source.type === "web" || source.type === "youtube" ? source.source : undefined;
    const { upserted } = await upsertChunksBatched(
      projectId,
      chunks.map(c => ({ text: c, metadata: { title, source: sourceKey, ...(metaUrl ? { url: metaUrl } : {}), type: source.type } }))
    );

    // 5. Mark indexed.
    await setStatus(sourceId, "indexed", { error: null, lastIndexedAt: new Date() });
    return { sourceId, chunks: chunks.length, upserted };
  } catch (err: any) {
    const message = err?.message ? String(err.message).slice(0, 1000) : "Ingestion failed";
    await setStatus(sourceId, "failed", { error: message }).catch(() => {});
    throw err;
  }
}
