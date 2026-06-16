# SiteGist — Project Memory

SiteGist is a SiteGPT-style RAG chatbot SaaS: Remix on Vercel, Postgres/Prisma (multi-tenant),
Pinecone vector store, hybrid retrieval + Cohere rerank via Portkey, OpenAI/Gemini embeddings.

## Architecture plan & roadmap
The full architecture redesign, roadmap, and current known issues live in:
**`docs/ARCHITECTURE_ROADMAP.md`** — read it before doing architecture/infra/ingestion work.

## Critical operational guardrails
- Prod DB was provisioned with `prisma db push` (no migration history).
  **Never run `prisma migrate deploy` inside the Vercel web build** — it fails on existing tables
  and blocks deploys. Run migrations as a separate, baselined CI step instead.
- Keep file-upload parsing on native `request.formData()` (NOT `unstable_parseMultipartFormData`).
