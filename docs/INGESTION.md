# Ingestion pipeline (v2)

The write path (source → vectors) is a durable, observable, incremental pipeline.

## State machine
`KnowledgeSource.status`: **queued → crawling → embedding → indexed | failed**

- **queued** — created by a training action, waiting for the worker.
- **crawling** — fetching content (web crawl / YouTube transcript). `text`/`file` skip straight to embedding.
- **embedding** — chunking + embedding + upserting; `chunksIndexed / chunksTotal` drive a live progress bar.
- **indexed** — done; `lastIndexedAt` and `contentHash` recorded.
- **failed** — `error` holds the message; the row shows a Retry button.

The Train page polls the loader every 4s while any source is in flight, so badges and
progress update live without a refresh.

## Incremental sync
After resolving content we hash it (sha256). If the hash matches `contentHash` from the
last successful index **and** the source is already `indexed`, embedding is skipped
entirely. This makes scheduled re-syncs and re-crawls cheap (no re-embedding unchanged
pages). A manual **Retry** sets status back to `queued` and always re-embeds.

## Token-based chunking
`app/ai-layer/chunking.server.ts` (`chunkTextByTokens`) splits on real tokens
(cl100k_base) instead of characters, targeting ~600 tokens with ~80 token overlap, and
splits recursively by Markdown headings → paragraphs → sentences → words so chunks align
to document structure. Tune `targetTokens` / `overlapTokens` per source type if needed.

## Batched, concurrency-limited embedding
`embedTexts` sends up to 96 inputs per OpenAI request (Gemini runs 5 at a time). Embedding
+ upsert happen one batch at a time so progress is reported and partial work survives a
mid-run failure (the next retry re-upserts deterministically by content hash).

## Dead-letter / retry
Failures set `status = failed` with the error message; Inngest also retries transient
failures up to 3× automatically. The Train UI exposes a manual **Retry** (`retry_source`)
per source. Scheduled `syncProjectSources` now re-enqueues web sources through this same
pipeline (so it benefits from incremental skip).

## Connection pooling (already supported)
`app/database/db.server.ts` supports pooled connections out of the box:
- **Prisma Accelerate**: set `DATABASE_URL` to your `prisma://...` Accelerate URL; the
  client auto-enables `withAccelerate()`.
- **Neon/PgBouncer pooler**: point `DATABASE_URL` at the pooled endpoint and set
  `DIRECT_DATABASE_URL` to the direct endpoint (used as a failover and for migrations).
On serverless this is strongly recommended to avoid exhausting database connections.
