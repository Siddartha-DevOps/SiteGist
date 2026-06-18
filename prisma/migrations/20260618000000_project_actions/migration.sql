-- Agentic AI Actions (function-calling): per-project HTTP tools the chatbot can
-- invoke at answer time (e.g. lookup order, book demo, hit your API), then ground
-- its reply on the live result.
--
-- Additive and idempotent so it is safe to apply against a drifted/db-push'd
-- production database (per docs/DB_MIGRATIONS.md — never run via the web build).

CREATE TABLE IF NOT EXISTS "ProjectAction" (
  "id"           TEXT NOT NULL,
  "projectId"    TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "description"  TEXT NOT NULL,
  "parameters"   JSONB,
  "method"       TEXT NOT NULL DEFAULT 'GET',
  "urlTemplate"  TEXT NOT NULL,
  "headers"      JSONB,
  "bodyTemplate" TEXT,
  "timeoutMs"    INTEGER NOT NULL DEFAULT 8000,
  "enabled"      BOOLEAN NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectAction_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "ProjectAction"
    ADD CONSTRAINT "ProjectAction_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectAction_projectId_name_key" ON "ProjectAction"("projectId", "name");
CREATE INDEX IF NOT EXISTS "ProjectAction_projectId_idx" ON "ProjectAction"("projectId");
