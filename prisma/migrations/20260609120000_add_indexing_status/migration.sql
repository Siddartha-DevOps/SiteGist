-- AddIndexingStatusToKnowledgeSource
ALTER TABLE "KnowledgeSource" ADD COLUMN "indexingStatus" TEXT NOT NULL DEFAULT 'INDEXED';
ALTER TABLE "KnowledgeSource" ADD COLUMN "indexingError"  TEXT;
ALTER TABLE "KnowledgeSource" ADD COLUMN "indexedAt"      TIMESTAMP(3);

-- Indexes for status polling queries
CREATE INDEX "KnowledgeSource_projectId_indexingStatus_idx" ON "KnowledgeSource"("projectId", "indexingStatus");
