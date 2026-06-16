-- Incremental sync + ingestion progress on KnowledgeSource.
-- Idempotent/additive so it is safe against a drifted/db-push'd database.

ALTER TABLE "KnowledgeSource" ADD COLUMN IF NOT EXISTS "contentHash" TEXT;
ALTER TABLE "KnowledgeSource" ADD COLUMN IF NOT EXISTS "chunksTotal" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "KnowledgeSource" ADD COLUMN IF NOT EXISTS "chunksIndexed" INTEGER NOT NULL DEFAULT 0;
