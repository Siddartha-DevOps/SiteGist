-- Audit log: records security-relevant actions (API keys, members, integrations,
-- settings, deletions) for trust/compliance.
-- Additive and idempotent — safe against a drifted/db-push'd production database
-- (per docs/ARCHITECTURE_ROADMAP.md — never run via the web build).

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "projectId" TEXT,
  "action"    TEXT NOT NULL,
  "target"    TEXT,
  "metadata"  JSONB,
  "ip"        TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "AuditLog"
    ADD CONSTRAINT "AuditLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_projectId_idx" ON "AuditLog"("projectId");
