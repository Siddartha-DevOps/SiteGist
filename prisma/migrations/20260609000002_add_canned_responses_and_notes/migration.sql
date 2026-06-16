-- CannedResponse (quick-reply templates for human agents) + ConversationNote
-- (internal agent notes, not visible to the customer).
-- Idempotent/additive so it is safe against a drifted/db-push'd database.

CREATE TABLE IF NOT EXISTS "CannedResponse" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CannedResponse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ConversationNote" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CannedResponse_projectId_idx" ON "CannedResponse"("projectId");
CREATE INDEX IF NOT EXISTS "ConversationNote_sessionId_idx" ON "ConversationNote"("sessionId");

DO $$ BEGIN
  ALTER TABLE "CannedResponse" ADD CONSTRAINT "CannedResponse_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ConversationNote" ADD CONSTRAINT "ConversationNote_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
