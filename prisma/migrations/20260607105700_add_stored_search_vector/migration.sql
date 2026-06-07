-- AlterTable to add the stored generated tsvector column
ALTER TABLE "KnowledgeSource" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (to_tsvector('english', COALESCE("content", ''))) STORED;

-- Create GIN index on "search_vector"
CREATE INDEX "KnowledgeSource_search_vector_idx" ON "KnowledgeSource" USING GIN ("search_vector");

-- Create btree index on "projectId" for faster WHERE filter
CREATE INDEX IF NOT EXISTS "KnowledgeSource_projectId_idx" ON "KnowledgeSource"("projectId");
