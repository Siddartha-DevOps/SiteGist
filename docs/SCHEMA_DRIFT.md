# Schema drift — audit & prevention

The recrawl outage ("column KnowledgeSource.recrawlIntervalDays does not exist")
happened because a feature was added to `schema.prisma` via `db push` with no
migration file, so `migrate deploy` never applied it and production drifted.
This doc covers the three layers that now guard against that.

## 1. Current state (audited)

`schema.prisma` **matches the migration history** — every column in every model
is created by a migration. The recrawl columns were the *only* drift, and it was
fixed in PR #52 (`20260724000000_add_recrawl_schedule`). No other schema-vs-
migration drift exists.

> The remaining unknown is whether **production** matches the migrations. The
> recrawl crash proved prod had drifted from them at least once. Verify with the
> prod audit below — it needs the direct DB URL, which CI does not have.

## 2. Prevent recurrence — CI (`.github/workflows/schema-check.yml`)

On any change to `prisma/schema.prisma` or `prisma/migrations/**`, CI replays the
migration history onto a throwaway Postgres and diffs it against `schema.prisma`.
The delta (or "no drift") is written to the run summary. It is **report-only**
today so managed raw-SQL objects (the `tsvector` `search_vector` + GIN index)
can't spurious-fail a PR; flip the diff step to `--exit-code` to make it a hard
gate once you've confirmed it's clean in practice.

**Golden rule:** never edit `schema.prisma` without a migration. Use
`npx prisma migrate dev --name <change>` locally, which writes the migration file
alongside the schema change.

## 3. Audit & fix production

Find exactly what prod is missing (read-only, prints SQL, applies nothing):

```bash
DATABASE_URL="postgresql://…DIRECT-prod-url…" ./scripts/audit-prod-drift.sh
```

Use the **direct** Postgres URL, not the `prisma://` Accelerate URL. If the output
is non-empty, apply it via the DB console, `npx prisma db push`, or
**GitHub → Actions → "Database schema sync" → Run workflow** (which runs
`prisma db push` with the `MIGRATE_DATABASE_URL` secret).

---

# Provider resilience & answer quality (ops action items)

These are configuration, not code — the code already handles them:

1. **Rotate the Gemini key.** It's currently returning 429 (dead/quota), so
   there is no real LLM fallback — one OpenAI incident takes the bot down.
   Create a fresh key at aistudio.google.com/app/apikey and set `GEMINI_API_KEY`
   in the Vercel **Production** scope, then redeploy. The generator already
   fails over OpenAI → Gemini (`streamRAG`), so a working Gemini key restores the
   safety net.

2. **Turn on reranking.** Set `RERANK_ENABLED=true` plus a provider
   (`PORTKEY_API_KEY` + `PORTKEY_COHERE_VIRTUAL_KEY`, or `RERANK_URL`). Reranking
   is the biggest answer-relevance lever and is currently off, so quality is
   below what the retrieval code can do.

Verify both from the live site: **`GET /api/health`** — `llm` and (once enabled)
`rerank` should read `ok`.
