# Changelog

Notable changes to SiteGist. Newest first. Dates are approximate.

## Reliability & production hardening (this cycle)

### Fixed
- **Homepage "Ask SiteGist" widget showed no reply** — the SSE parser never
  reset the event type, so content frames after the initial `event: session`
  were dropped. (`ChatWidget.tsx`)
- **Embed widget** — unreachable SSE branch broke session memory, feedback, and
  citation rendering; and the lead form triggered on the bot's answer instead of
  the visitor's intent.
- **Bot Settings save wiped unmanaged keys** — the action rebuilt `settings`
  from scratch. Now merges over existing settings (`mergeProjectSettings`).
- **Prod schema drift** — `KnowledgeSource.recrawlIntervalDays/nextRecrawlAt`
  were added via `db push` with no migration, crashing project pages. Backfill
  migration added; DB CI switched to `prisma db push`.
- **`PORTKEY_MODEL` outage class** — boot now rejects a provider-namespaced model
  with no Portkey routing (the Jul-9 outage).
- Gemini→OpenAI fallback for follow-up suggestions; key fragments no longer
  logged in production.

### Added
- **Automated tests** — first vitest unit suite (SSE framing, settings-merge,
  domain allowlist, env-rules), CI-gated; Playwright widget smoke.
- **`/api/health`** — DB / LLM / Redis / email / Pinecone / rerank probe; 503 on
  critical failure; safe for public monitors.
- **SEO** — `robots.txt`, dynamic `sitemap.xml` (incl. published blog posts),
  per-post meta on `/blog/$slug`, `/blog` empty state.
- **Integrations** — real Zendesk (ticket-on-escalation) and HubSpot
  (contact-on-lead); marketing catalog marks unbuilt connectors "Coming soon".
- **Explicit `RERANK_ENABLED` flag**; **provider registry** (`AI_PROVIDER`,
  explicit `EMBEDDING_DIMENSION`) for the local-LLM path.
- **WordPress plugin** (installable) and **industry lead templates**.
- **Schema-drift CI guard** + `scripts/audit-prod-drift.sh`.
- **Viewport-safe floating widget**; deploy build-stamp (`window.ENV.BUILD_SHA`).

### Removed
- Unauthenticated debug routes (`api.debug-env`, `api.debug.paddle-checkout`)
  that leaked env names and partial secrets.

## Docs
- `docs/PROD_ENV_CHECKLIST.md`, `docs/SCHEMA_DRIFT.md`, `docs/RUNBOOK.md`.
