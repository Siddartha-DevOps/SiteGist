-- AiAction: per-project tool/function-calling actions the chatbot can invoke.
-- Idempotent/additive so it is safe against a drifted/db-push'd database.

CREATE TABLE IF NOT EXISTS "AiAction" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "parameters" JSONB NOT NULL DEFAULT '[]',
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'POST',
    "headers" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AiAction_projectId_idx" ON "AiAction"("projectId");

DO $$ BEGIN
  ALTER TABLE "AiAction" ADD CONSTRAINT "AiAction_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
