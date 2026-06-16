# SiteGist — Architecture Redesign & Roadmap

> Goal: make SiteGist match and then beat a production-grade RAG SaaS (SiteGPT-style)
> across architecture, infrastructure, system design, and product reliability.
>
> Status legend: ✅ keep · ♻️ change · ➕ add · 🔴 critical gap

## The single root problem
SiteGist's **AI design is already strong** (hybrid retrieval + rerank + Q&A overrides +
provider abstraction). It loses on **infrastructure fundamentals**:
1. 🔴 Ingestion (crawl + embed) runs **synchronously inside serverless requests** → timeouts,
   hard caps (30 pages / 20 videos).
2. 🔴 No clean **deploy/migration** story → schema drift, broken deploys.

Fix these two and most of the gap closes.

## Current stack (keep)
Remix on Vercel (web + streaming chat API) · Postgres/Prisma (multi-tenant) ·
Pinecone (namespace per project) · Hybrid retrieval (vector + Postgres FTS/tsvector+GIN) ·
Cohere rerank via Portkey · OpenAI/Gemini embeddings (swappable) · SSE streaming ·
embeddable widget · public API v1 · integrations (Notion/Drive/Zendesk/Messenger/...).

## 1. Architecture — split write path from read path
```
READ  (sync, fast):  Widget → /api/chat → hybrid retrieve → rerank → LLM stream → answer+sources
WRITE (async, durable): Source added → EVENT → Workflow: fetch → parse → chunk → embed(batched)
                        → upsert → mark indexed → notify
```
➕ Adopt a durable, event-driven workflow engine — **Inngest** (or Trigger.dev). Serverless-native,
gives retries / concurrency / step durability / scheduling. Removes timeouts and the page/video caps.

## 2. System design (component decisions)
**Ingestion (redesign):**
- ➕ Per-source state machine on `KnowledgeSource`: queued→crawling→parsing→embedding→indexed→failed (+ live progress UI).
- ➕ Incremental sync: content-hash pages, skip unchanged (extend existing sha256 chunk hashing to source level).
- ♻️ Replace `Promise.all(all chunks)` embedding with **batched + concurrency-limited** (OpenAI ~96 inputs/call, `p-limit`).
- ➕ Dead-letter queue + admin retry for failed jobs.

**Retrieval/answer quality:**
- 🔴 **Turn reranking ON** — currently disabled in prod (`hasCohere:false`). Free quality win.
- ♻️ Token-based chunking (tiktoken, 500–800 tokens, recursive/heading-aware) instead of 1200 chars.
- ➕ Query rewriting / multi-query / HyDE before retrieval (recall boost).
- ➕ Grounding guardrails: force citations; "I don't know" below score threshold.
- ➕ Eval harness: golden Q&A set scored on recall@k + answer quality, run in CI (accuracy guarantee).

**Data layer:**
- 🔴 **Connection pooling** on serverless (Prisma Accelerate / Neon pooler / PgBouncer) — avoid connection exhaustion.
- (Optional, later) consolidate on **pgvector** to drop Pinecone (one store, lower cost).

## 3. Infrastructure / DevOps (biggest deficit)
- 🔴 Pick ONE schema model. Recommended: adopt Prisma migrations properly —
  baseline prod once (`prisma migrate resolve --applied <existing>`), then run
  `prisma migrate deploy` as a **separate GitHub Actions step on merge to main**,
  **NOT inside the Vercel web build** (that coupling broke deploys).
- ➕ Separate databases per environment (dev / preview / prod). Preview must never touch prod DB.
- ➕ CI/CD (GitHub Actions): typecheck → lint → build → migrate deploy → post-deploy `/api/health` smoke test.
- ➕ Observability: Sentry (errors) + structured logs + OpenTelemetry traces; dashboards for
  ingestion success rate, retrieval latency, token cost/tenant.
- ➕ Typed env validation (zod) at boot — fail fast.
- ➕ Rate limiting + abuse protection on public chat API (Upstash Redis).
- ➕ Caching (Redis): repeated-query embeddings, hot KB chunks, sessions.

## 4. Working product (parity + differentiation)
Parity: async onboarding ("paste URL → watch it train live → bot in minutes"), feedback→KB loop,
unanswered-question mining → suggested Q&A, analytics, lead capture, human handoff.
Differentiate (to win): agentic tools/actions · multi-LLM choice (productize the abstraction) ·
white-label + deeper per-tenant analytics · eval-backed accuracy SLAs.

## Execution roadmap
| Phase | Goal | Key work |
|---|---|---|
| Week 1 — stabilize | stable & deploying | fix migration/deploy model; fix file-upload crash; create missing tables; turn on rerank; Sentry + zod env validation; connection pooling |
| Weeks 2–4 — decouple ingestion | kill #1 gap | Inngest; async crawl+embed workflow; remove caps; per-source status + progress UI; content-hash incremental sync; batched embeddings |
| Weeks 5–8 — quality & scale | out-retrieve | token chunking; query rewriting; eval harness in CI; Redis cache + rate limiting; observability; cost controls |
| Weeks 9–12 — differentiate | win | agent tools; white-label; advanced analytics; accuracy SLAs |

## Immediate actions (this week, in order)
1. Fix the deploy/migration model (separate migrate step, baseline prod) — unblocks everything.
2. Create the missing tables + re-apply the file-upload fix (native `request.formData()`).
3. Turn on reranking + add connection pooling + Sentry.

## Known live issues (as of last session, 2026-06-08)
- Prod DB was provisioned via `prisma db push` (no migration history) → `migrate deploy` in the
  build fails ("table already exists") and blocks Vercel deploys. **Do NOT run `migrate deploy`
  in the Vercel web build.**
- `main` (commit 5562e3e) reverted the build to the original command (deploys OK) but re-introduced
  the broken `unstable_parseMultipartFormData` (file uploads still crash) and dropped the drift migration.
- Missing tables in prod: `KnowledgeQA`, `ProjectMember`, `ConversationTag`, `LeadTag`,
  `BillingPayment`, `ApiKey` (+ added columns on ChatSession/Lead/Project/User/BillingSubscription).
  The idempotent, additive SQL to create them lives on branch `claude/happy-ritchie-qB97D` at
  `prisma/migrations/20260608000000_sync_schema_drift/migration.sql` — safe to run directly against prod.

## How to resume in a new session
Tell Claude: "Read docs/ARCHITECTURE_ROADMAP.md and continue with the immediate actions."
(This file is the durable memory — keep it updated as work progresses.)
