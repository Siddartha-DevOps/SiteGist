-- Canned responses for inbox agent quick-replies (idempotent for db-push'd prod).
CREATE TABLE IF NOT EXISTS "CannedResponse" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CannedResponse_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CannedResponse_projectId_idx" ON "CannedResponse"("projectId");

DO $$ BEGIN
  ALTER TABLE "CannedResponse"
    ADD CONSTRAINT "CannedResponse_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
