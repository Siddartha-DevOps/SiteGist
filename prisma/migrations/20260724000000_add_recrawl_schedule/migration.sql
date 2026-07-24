-- Auto-recrawl scheduling columns on KnowledgeSource.
--
-- These were originally added to schema.prisma via `prisma db push` without a
-- migration file, so `migrate deploy` never applied them to production — which
-- crashed any query loading a project's knowledge sources
-- ("column KnowledgeSource.recrawlIntervalDays does not exist"). This backfills
-- the migration. IF NOT EXISTS keeps it safe on databases that already received
-- the columns via a prior db push.

ALTER TABLE "KnowledgeSource" ADD COLUMN IF NOT EXISTS "recrawlIntervalDays" INTEGER;
ALTER TABLE "KnowledgeSource" ADD COLUMN IF NOT EXISTS "nextRecrawlAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "KnowledgeSource_nextRecrawlAt_idx" ON "KnowledgeSource"("nextRecrawlAt");
