# Observability

Three layers, all dependency-free and no-op until configured.

## 1. Error tracking (Sentry)
`app/lib/monitoring.server.ts` posts exceptions to Sentry's envelope endpoint —
no SDK, no bundle bloat. It's a no-op unless `SENTRY_DSN` is set.

- **Global capture:** `entry.server.tsx` exports `handleError`, which Remix calls
  for every uncaught loader/action/render error → reported automatically.
- **Hot-path capture:** ingestion failures (`ingestKnowledgeSource`) and retrieval
  failures (`streamRAG`) call `captureException` with context (sourceId, projectId, type).

Enable: set `SENTRY_DSN` in the environment. That's it.

## 2. Structured logs + metrics
`app/lib/logger.server.ts` emits one JSON object per line:

```json
{"ts":"…","level":"info","event":"ingest.source","sourceId":"…","type":"web","ok":true,"chunks":12,"upserted":12,"duration_ms":3412}
{"ts":"…","level":"info","event":"rag.retrieval","projectId":"…","ok":true,"candidates":18,"ranked":5,"rerank":false,"multiQuery":false,"duration_ms":840}
```

- `log.info/warn/error(event, fields)` — leveled (`LOG_LEVEL`, default `info` in prod).
- `log.metric(name, value, fields)` — numeric measurements to chart.
- `startTimer(event, fields)` — returns a fn that logs `duration_ms` when called.

Instrumented today: **ingestion** (`ingest.source`: duration, chunks, upserted, ok/skipped)
and **retrieval** (`rag.retrieval`: latency, candidate/ranked counts, whether rerank +
multi-query were active). Drain these to any log platform (Datadog, Logtail, Axiom…)
from Vercel → Integrations to chart ingestion success rate, retrieval latency, etc.

## 3. Ops dashboard data
`GET /api/admin/metrics` (auth required) returns, for the signed-in account:

- `sources`: total, breakdown by status, **success rate**, in-flight, failed counts
- `recentFailures`: last 10 failed sources with their error messages
- `config`: which features are active (async ingestion, rerank, multi-query, Sentry)

Use it to power an in-app "training health" panel or external monitoring.

## Recommended setup
| Want | Set |
|---|---|
| Crash reports in Sentry | `SENTRY_DSN` |
| Verbose/quiet logs | `LOG_LEVEL` = `debug` \| `info` \| `warn` \| `error` |
| Charts (latency, success rate) | add a Vercel log drain (Axiom/Logtail/Datadog) |
