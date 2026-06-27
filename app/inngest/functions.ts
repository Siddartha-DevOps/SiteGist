import { inngest, INGEST_SOURCE_EVENT } from "./client";
import { ingestKnowledgeSource } from "~/ai-layer/ingestion.server";

/**
 * Durable ingestion of a single knowledge source.
 *
 * - retries: 3        → transient crawl/embed failures are retried automatically
 * - concurrency: 5    → cap parallel ingests so we don't blow embedding rate limits
 *
 * Each run is a step so Inngest records its outcome durably; on failure the row
 * is marked `failed` (inside ingestKnowledgeSource) and the function retries.
 */
export const ingestSource = inngest.createFunction(
  {
    id: "ingest-source",
    retries: 3,
    concurrency: { limit: 5 },
  },
  { event: INGEST_SOURCE_EVENT },
  async ({ event, step }) => {
    const { sourceId, force } = event.data;
    const result = await step.run("ingest-knowledge-source", () => ingestKnowledgeSource(sourceId, { force }));
    return result;
  }
);

export const functions = [ingestSource];
