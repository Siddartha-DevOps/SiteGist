# Retrieval & answer quality

The answer path (`streamRAG` in `app/ai-layer/ai.server.ts`) is:

```
query → Q&A override check → standalone query rewrite → hybrid retrieve (vector + keyword FTS)
      → [optional multi-query] → rerank → grounding guard → LLM (streamed) + citations
```

## Reranking (Cohere v3 via Portkey)
Reranking is already wired into the pipeline; it just needs keys to activate. Set:

- `PORTKEY_API_KEY`
- `PORTKEY_COHERE_VIRTUAL_KEY`

When these are absent the pipeline **falls back to score-sorted top-5** (improved: it
now orders candidates by hybrid score instead of arbitrary order), so retrieval is
reasonable even without Cohere — but enabling rerank is a meaningful, low-effort quality win.

## Multi-query expansion (opt-in)
Set `RAG_MULTI_QUERY=1` to also search 2 LLM-generated alternative phrasings of the
query and merge in any new vector matches before reranking — a recall boost for
under-specified questions. Off by default (zero behaviour/latency change when unset).

## Grounding guardrails (already enforced)
- A **score threshold** (`VECTOR_SCORE_THRESHOLD = 0.30`) filters weak vector matches.
- A **zero-context guard** returns the "I don't have information about that" fallback
  when nothing relevant is retrieved (no hallucinated answers).
- The prompt enforces "answer only from context", no fabrication, and returns the
  fallback line when the context lacks the answer. Citations are streamed as metadata.

## Eval harness (accuracy guarantee)
`scripts/eval-retrieval.mjs` runs a golden set of questions against a deployed instance
and scores grounding + keyword recall.

1. Create your golden set from the template:
   ```
   cp eval/golden.example.jsonl eval/golden.jsonl
   # edit: set projectId, questions, expectKeywords, mustBeGrounded
   ```
   (`eval/golden.jsonl` is gitignored — it's project-specific. Commit it intentionally
   if you want CI to run it.)
2. Run locally:
   ```
   EVAL_BASE_URL=https://www.sitegist.co node scripts/eval-retrieval.mjs
   ```
3. CI: the **RAG eval** workflow (`.github/workflows/eval.yml`) runs daily and on demand.
   Add an `EVAL_BASE_URL` repo secret and commit `eval/golden.jsonl`. It fails when the
   pass rate drops below `MIN_PASS_RATE` (default 0.7).

Scoring:
- `mustBeGrounded: true`  → answer must not be the fallback and must contain every `expectKeyword`.
- `mustBeGrounded: false` → answer should be the fallback (the bot correctly declines out-of-scope questions).
