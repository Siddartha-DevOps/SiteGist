#!/usr/bin/env node
/**
 * RAG eval harness (black-box).
 *
 * Runs a golden set of questions against a deployed chat endpoint and scores
 * grounding + keyword recall, giving an accuracy signal you can gate CI on.
 *
 * Env:
 *   EVAL_BASE_URL   Base URL of a deployed instance (e.g. https://www.sitegist.co)  [required]
 *   GOLDEN_FILE     Path to JSONL golden set (default: eval/golden.jsonl)
 *   MIN_PASS_RATE   Minimum fraction to pass, 0..1 (default: 0.7)
 *
 * Golden line shape (JSONL):
 *   { "projectId": "...", "question": "...", "expectKeywords": ["..."], "mustBeGrounded": true }
 *   - mustBeGrounded:true  -> answer must NOT be the "I don't know" fallback and must contain every expectKeyword.
 *   - mustBeGrounded:false -> answer SHOULD be the fallback (bot correctly declines out-of-scope questions).
 *
 * Usage:
 *   EVAL_BASE_URL=https://www.sitegist.co node scripts/eval-retrieval.mjs
 */
import { readFileSync } from "node:fs";

const BASE_URL = process.env.EVAL_BASE_URL;
const GOLDEN_FILE = process.env.GOLDEN_FILE || "eval/golden.jsonl";
const MIN_PASS_RATE = Number(process.env.MIN_PASS_RATE ?? "0.7");

if (!BASE_URL) {
  console.error("EVAL_BASE_URL is required (e.g. https://www.sitegist.co).");
  process.exit(2);
}

const FALLBACK_MARKERS = [
  "don't have information about that",
  "do not have information about that",
  "contact our support team",
  "specialized only in sitegist",
];
const isFallback = (text) => {
  const t = text.toLowerCase();
  return FALLBACK_MARKERS.some((m) => t.includes(m));
};

/** POST a question and reconstruct the streamed answer text from SSE `data:` frames. */
async function ask(projectId, question) {
  const res = await fetch(`${BASE_URL.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, message: question }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

  const body = await res.text(); // small responses; read fully then parse SSE
  let answer = "";
  for (const line of body.split("\n")) {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const obj = JSON.parse(payload);
      if (typeof obj.content === "string") answer += obj.content;
    } catch {
      /* non-JSON data frame (event payloads) — ignore */
    }
  }
  return answer.trim();
}

function loadGolden(file) {
  return readFileSync(file, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l, i) => {
      try {
        return JSON.parse(l);
      } catch (e) {
        throw new Error(`Invalid JSON on golden line ${i + 1}: ${e.message}`);
      }
    });
}

function scoreItem(item, answer) {
  const grounded = !isFallback(answer);
  const kws = (item.expectKeywords || []).map((k) => k.toLowerCase());
  const recall = kws.length === 0 ? 1 : kws.filter((k) => answer.toLowerCase().includes(k)).length / kws.length;

  let pass;
  if (item.mustBeGrounded === false) {
    pass = !grounded; // should correctly decline
  } else {
    pass = grounded && recall === 1;
  }
  return { grounded, recall, pass };
}

const main = async () => {
  const golden = loadGolden(GOLDEN_FILE);
  if (golden.length === 0) {
    console.error(`No golden items found in ${GOLDEN_FILE}.`);
    process.exit(2);
  }
  console.log(`Running ${golden.length} eval(s) against ${BASE_URL}\n`);

  let passed = 0;
  for (const item of golden) {
    let result, answer = "";
    try {
      answer = await ask(item.projectId, item.question);
      result = scoreItem(item, answer);
    } catch (e) {
      result = { grounded: false, recall: 0, pass: false, error: e.message };
    }
    if (result.pass) passed++;
    const icon = result.pass ? "PASS" : "FAIL";
    const detail = result.error
      ? `error: ${result.error}`
      : `grounded=${result.grounded} recall=${(result.recall * 100).toFixed(0)}%`;
    console.log(`[${icon}] ${item.question}\n        ${detail}`);
    if (!result.pass && answer) console.log(`        answer: ${answer.slice(0, 140).replace(/\n/g, " ")}…`);
  }

  const rate = passed / golden.length;
  console.log(`\nPass rate: ${(rate * 100).toFixed(1)}% (${passed}/${golden.length}); threshold ${(MIN_PASS_RATE * 100).toFixed(0)}%`);
  if (rate < MIN_PASS_RATE) {
    console.error("Eval FAILED — below threshold.");
    process.exit(1);
  }
  console.log("Eval passed.");
};

main().catch((e) => {
  console.error("Eval crashed:", e);
  process.exit(2);
});
