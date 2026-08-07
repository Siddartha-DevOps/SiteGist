# Runbook

Operational procedures so schema/env/deploy changes don't surprise production.
Companion to `PROD_ENV_CHECKLIST.md` (env reference) and `SCHEMA_DRIFT.md`.

## Deploy

1. Merge to `main`. Confirm **Vercel → Settings → Git → Production Branch = `main`**.
2. Ensure `main` auto-deploys to Production (or promote: Deployments → latest
   `main` → ⋯ → Promote to Production).
3. Verify the live build: the site console prints `[SiteGist] widget build: <sha>`
   — it must match the latest `main` commit.
4. Smoke-check: `GET /api/health` → `status: ok` (or `degraded` with a known,
   accepted reason).

## Changing environment variables

- Set values in the **Production** scope (Vercel scopes env per environment).
- **Redeploy after any env change** — existing deployments don't pick up new
  values.
- Re-check `GET /api/health` and confirm the affected service reads `ok`.
- Never store a secret under a `VITE_`-prefixed name (client-exposed). Boot warns
  if the OpenAI key is under `VITE_OPENAI_API_KEY`.

## Changing the database schema

1. **Never edit `prisma/schema.prisma` without a migration.** Run
   `npx prisma migrate dev --name <change>` locally — it writes the migration
   file alongside the schema change. (The `schema-check` CI catches schema edits
   with no migration.)
2. Apply to production via **Actions → "Database schema sync" → Run workflow**
   (`prisma db push` with the `MIGRATE_DATABASE_URL` secret), or
   `DATABASE_URL=<direct-prod-url> npx prisma db push`.
3. Audit prod at any time:
   `DATABASE_URL=<direct-prod-url> ./scripts/audit-prod-drift.sh`.

## Incident: "Database Connection Offline" / "column … does not exist"

Production DB is behind the schema. Run the schema sync (step 2 above). The
page recovers immediately — it's a DB change, no deploy needed.

## Incident: chatbot gives no reply

1. `GET /api/health` — is `llm` ok? If `not_configured`/error, fix the LLM env
   (`OPENAI_API_KEY`, `PORTKEY_MODEL=gpt-4o-mini`) in Production and redeploy.
2. If `llm` is ok but still no reply, check the browser Network tab: the
   `/api/chat` response — 429 (rate/quota), `[ERROR]` frame (provider), or empty.
3. Confirm the deployed build sha (console) matches `main` — a stale bundle can
   carry an old widget bug.

## Incident: unusual LLM bill / abuse

`GET /api/health` → is `redis` ok? If `not_configured`, per-IP abuse protection
is OFF — set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` and redeploy.

## Error reporting (Sentry)

- Set `SENTRY_DSN` (Production scope) to enable both server (`monitoring.server`)
  and browser (`sentry.client`) error capture. The DSN is public/write-only —
  safe to ship to the client (it's exposed via `window.ENV`).
- Client errors are tagged with `release = BUILD_SHA` (the commit sha).
- **Readable stack traces (source maps):** browser stacks are minified until you
  upload source maps to Sentry for the matching release. Add `@sentry/vite-plugin`
  with a `SENTRY_AUTH_TOKEN` (+ org/project) to `vite.config.ts`; it generates,
  uploads, and then deletes the maps at build time (so source isn't served
  publicly), keyed to `VERCEL_GIT_COMMIT_SHA`. This needs your Sentry auth token,
  so it's a one-time setup on your side — the capture works without it, just
  minified.

## Incident: users can't log in

Login is magic-link email. `GET /api/health` → is `email` ok? If
`not_configured`, set `RESEND_API_KEY` + `SENDER_EMAIL`. Verify the Resend
sending domain (SPF/DKIM) — config presence ≠ delivery.
