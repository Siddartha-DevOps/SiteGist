-- Async ingestion state tracking on KnowledgeSource.
-- Idempotent/additive so it is safe to apply against a drifted/db-push'd database.

ALTER TABLE "KnowledgeSource" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'indexed';
ALTER TABLE "KnowledgeSource" ADD COLUMN IF NOT EXISTS "error" TEXT;
ALTER TABLE "KnowledgeSource" ADD COLUMN IF NOT EXISTS "lastIndexedAt" TIMESTAMP(3);
