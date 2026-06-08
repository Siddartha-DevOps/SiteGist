# Async ingestion (Inngest) — setup

Ingestion (crawl → parse → chunk → embed → upsert) now runs through a durable
Inngest workflow instead of inside the HTTP request. The training actions create
`KnowledgeSource` rows with `status: "queued"` and emit an `ingest/source.requested`
event; the `ingest-source` function (retries: 3, concurrency: 5) does the work and
updates `status` to `processing → indexed | failed`. The Train page polls and shows
live status badges.

## Rollout safety
If Inngest is **not** configured, `enqueueSourceIngestion` falls back to running the
exact same ingestion **inline** (awaited) — i.e. the previous synchronous behaviour.
So nothing breaks before you wire Inngest up; you flip to async by setting the env vars.

`isAsyncIngestionEnabled()` returns true when `INNGEST_EVENT_KEY` or `INNGEST_DEV` is set.

## Local development
1. Run the app: `npm run dev`
2. In another terminal, run the Inngest dev server (auto-discovers `/api/inngest`):
   ```
   npx inngest-cli@latest dev
   ```
3. Set `INNGEST_DEV=1` in your local env so events route to the pipeline.
4. Open the dev dashboard at http://localhost:8288 to watch runs, retries, and logs.

## Production (Vercel)
1. Create an app at https://app.inngest.com and grab the **Event Key** and **Signing Key**.
2. In Vercel project env vars (Production) set:
   - `INNGEST_EVENT_KEY=...`
   - `INNGEST_SIGNING_KEY=...`
3. In the Inngest dashboard, add your serve endpoint URL: `https://<your-domain>/api/inngest`
   (Inngest syncs functions by calling it). Re-deploy if needed.
4. Once `INNGEST_EVENT_KEY` is present, all training routes automatically enqueue
   instead of running inline. No code change required.

## Endpoint
`GET/POST /api/inngest` — served by `app/routes/api.inngest.ts`. Inngest calls this to
discover and invoke functions; protect it with the signing key (set in env).
