-- ZapierHook: REST-hook subscriptions for Zapier fan-out.
-- Idempotent/additive so it is safe against a drifted/db-push'd database.

CREATE TABLE IF NOT EXISTS "ZapierHook" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "hookUrl" TEXT NOT NULL,
    "event" TEXT NOT NULL DEFAULT 'all',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZapierHook_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ZapierHook_projectId_idx" ON "ZapierHook"("projectId");
CREATE INDEX IF NOT EXISTS "ZapierHook_projectId_event_idx" ON "ZapierHook"("projectId", "event");

DO $$ BEGIN
  ALTER TABLE "ZapierHook" ADD CONSTRAINT "ZapierHook_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
