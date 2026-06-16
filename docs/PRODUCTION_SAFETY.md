# Production safety (Tier 0)

Hardening that makes SiteGist safe to take real money. All changes degrade
gracefully and are controlled by env where relevant.

## 1. No silent fake data (data integrity)
`db.server.ts` has a dev-only mock fallback that serves in-memory data when the
database is unreachable. In **production it is disabled** — the DB layer now
**throws** instead of serving/accepting fake data, so an outage surfaces as a real
error (captured by Sentry + logs) rather than a blank/wrong dashboard or a "saved"
record that silently vanishes.

- Prod default: fail loud.
- Escape hatch (not recommended in prod): `ALLOW_DB_MOCK=1`.

## 2. Quota fails closed (revenue + LLM-bill protection)
If the per-account quota check errors, `/api/chat` now returns **503** instead of
serving a billable LLM call. We never give away paid usage on an error path.

## 3. Default global rate limit (abuse / cost protection)
Every non-demo chat request is subject to a **global per-IP ceiling** (default
**30/min**, via `GLOBAL_RATE_LIMIT_PER_MIN`, `0` disables), in addition to any
per-project limit. This protects your LLM budget even for bots with no per-project
limit set.

> Requires Redis (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`). Without
> it, distributed rate limiting can't be enforced on serverless and a warning is logged.

## 4. Embedding cache (cost + latency)
Query embeddings are cached in Redis (`cache.server.ts`), keyed by provider + text
hash (7-day TTL). Repeated questions skip the embedding API entirely. No-op without
Redis. (Answer-level caching is a planned follow-up.)

## 5. Connection pooling
On serverless, point `DATABASE_URL` at a **pooled** endpoint and keep a direct URL
for migrations:
- **Prisma Accelerate:** `DATABASE_URL=prisma://…` (auto-enabled).
- **Neon:** pooled `-pooler` host for `DATABASE_URL`; direct host for `DIRECT_DATABASE_URL`.
- **Supabase:** PgBouncer `:6543` for `DATABASE_URL`; `:5432` for `DIRECT_DATABASE_URL`.

Production logs a one-time warning if `DATABASE_URL` doesn't look pooled.

## Recommended production env
| Var | Purpose |
|---|---|
| `DATABASE_URL` | pooled connection (Accelerate/PgBouncer/Neon pooler) |
| `DIRECT_DATABASE_URL` / `MIGRATE_DATABASE_URL` | direct connection for migrations |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | rate limiting + caching |
| `GLOBAL_RATE_LIMIT_PER_MIN` | global per-IP ceiling (default 30) |
| `SENTRY_DSN` | error tracking |

## Still open (tracked separately)
Tenant-isolation audit, full billing lifecycle (webhooks/upgrades/dunning),
prompt-injection guardrails, data deletion/export & compliance.
