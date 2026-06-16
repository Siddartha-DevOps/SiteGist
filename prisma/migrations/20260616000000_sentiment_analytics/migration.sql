-- Real sentiment analysis storage.
-- Additive and idempotent so it is safe to apply against a drifted/db-push'd
-- production database (per docs/DB_MIGRATIONS.md — never run via the web build).

-- Per-message sentiment label: "positive" | "neutral" | "negative" (null = not yet scored).
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "sentiment" TEXT;

-- Daily sentiment counts on the analytics snapshot for trend storage.
ALTER TABLE "AnalyticsSnapshot" ADD COLUMN IF NOT EXISTS "positiveCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AnalyticsSnapshot" ADD COLUMN IF NOT EXISTS "neutralCount"  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AnalyticsSnapshot" ADD COLUMN IF NOT EXISTS "negativeCount" INTEGER NOT NULL DEFAULT 0;
