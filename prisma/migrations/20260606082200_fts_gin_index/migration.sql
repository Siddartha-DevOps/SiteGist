-- Create GIN index for full-text search on KnowledgeSource content
CREATE INDEX IF NOT EXISTS knowledge_source_content_fts
ON "KnowledgeSource"
USING GIN (to_tsvector('english', COALESCE("content", '')));
