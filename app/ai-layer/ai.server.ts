import OpenAI from "openai";
import { pineconeIndex } from "~/lib/pinecone.server";
import { getPortkey } from "./portkey.server";
import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";
import { EMBEDDING_PROVIDER, EMBEDDING_DIMENSION } from "~/env.server";
import { maskSecret } from "~/lib/maskSecret";
import { isPlainGreeting } from "~/lib/chat-intents";
import { captureException } from "~/lib/monitoring.server";
import { log, startTimer } from "~/lib/logger.server";
import { cacheGet, cacheSet, cacheKey } from "~/lib/cache.server";
import { languageDirective } from "~/lib/language.server";

// Cohere rerank model. Defaults to the multilingual model so non-English queries
// rerank well too (matches the multilingual answer behaviour). Override with
// COHERE_RERANK_MODEL (e.g. "rerank-english-v3.0" for English-only deployments).
const RERANK_MODEL = process.env.COHERE_RERANK_MODEL?.trim() || "rerank-multilingual-v3.0";

const EMBED_CACHE_TTL = 60 * 60 * 24 * 7; // 7 days

const VECTOR_SCORE_THRESHOLD = 0.30;

const GEMINI_CHAT_MAX_TOKENS     = 2048;
const GEMINI_VERIFY_MAX_TOKENS   = 256;
const GEMINI_SIMPLE_MAX_TOKENS   = 1024;

const USER_FACING_ERROR = "Sorry, I'm having trouble responding right now. Please try again in a moment.";

if (process.env.AI_DEBUG === "1") {
  console.log("AI Server Startup Diagnostic:", {
    hasGemini: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    hasOpenAI: !!(process.env.OPENAI_KEY || process.env.OPENAI_API_KEY || process.env.OpenAI_API_KEY || process.env.VITE_OPENAI_API_KEY),
    hasPortkey: !!(process.env.PORTKEY_API_KEY),
  });
}

function cleanKey(val: any): string | null {
  if (!val || typeof val !== "string") return null;
  
  let raw = val.trim();
  
  // Detect and warn about 'k-proj-' vs 'sk-proj-'
  if (raw.startsWith("k-proj-")) {
    console.warn(`[AI] TYPO_DETECTED: Key starts with 'k-proj-'. It almost certainly should be 'sk-proj-'. Please check the first letter.`);
  }

  // CRITICAL: Block masked keys early. 
  // Dashboards often show "sk-proj-****" or "AIZa...••••"
  if (raw.includes("*") || raw.includes("•") || (raw.includes("...") && raw.length < 50) || raw.includes("****")) {
     console.error(`[AI] MASKED_KEY_DETECTED: Your key looks like a placeholder (contains stars, dots, or hidden chars). Value: ${maskSecret(raw)}`);
     return null; 
  }

  // Handle case where user pastes "GEMINI_API_KEY=AIZa..."
  const envMatch = raw.match(/^[a-z0-9_]+=(.*)$/i);
  if (envMatch) {
    raw = envMatch[1].trim();
  }

  // Common copy-paste artifacts
  const commonLabels = [
    "openai_api_key:", "openai_key:", "openai:", "key:", "api_key:",
    "gemini_api_key:", "gemini_key:", "gemini:", "google_api_key:",
    "bearer ", "token:", "sk-proj-", "sk-" 
  ];
  
  let tempRaw = raw.toLowerCase();
  for (const label of commonLabels) {
    if (tempRaw.startsWith(label)) {
      if (label.includes(":")) {
         raw = raw.slice(label.length).trim();
         tempRaw = raw.toLowerCase();
      }
    }
  }

  // Remove wrapping quotes
  raw = raw.replace(/^['"]|['"]$/g, "").trim();

  // Remove ALL whitespace and non-printable characters.
  // We explicitly target invisible characters like zero-width spaces (\u200B) often found in copy-pastes.
  let cleaned = raw.replace(/[\s\u00A0\u1680\u180e\u2000-\u200b\u202f\u205f\u3000\ufeff\x00-\x1f\x7f-\x9f]/g, "");
  
  // CRITICAL: Block masked keys. 
  // Dashboards often show "sk-proj-****" or "AIZa...••••"
  if (cleaned.includes("*") || cleaned.includes("•") || cleaned.includes("...") || cleaned.includes("****")) {
     console.error(`[AI] MASKED_KEY_REJECTED: Found asterisks or dots in key. Value Masked: ${maskSecret(cleaned)}`);
     return null; 
  }

  // Basic check for dummy values
  const dummyValues = ["your_gemini_api_key", "your_openai_api_key", "your_portkey_api_key", "null", "undefined", "", "true", "false", "your-key-here", "placeholder", "key_here"];
  if (dummyValues.includes(cleaned.toLowerCase()) || (cleaned.length < 10 && !cleaned.includes("_"))) {
    return null;
  }
  
  return cleaned;
}

function getDiagnosticInfo(key: string | null | undefined): string {
  if (!key) return "NOT_FOUND";
  const length = key.length;
  // Show only first 4 characters and last 4 characters
  const start = key.substring(0, 4);
  const end = key.slice(-4);
  
  // Check for common masking patterns
  const isMasked = key.includes("*") || key.includes("•") || key.includes("...");
  const isDummy = key.toLowerCase().includes("key_here") || key.toLowerCase().includes("placeholder");
  const isProbablyOpenAIButMissingS = key.startsWith("k-proj-");
  
  // Check for hidden characters
  const hiddenChars = [];
  for (let i = 0; i < key.length; i++) {
    const code = key.charCodeAt(i);
    if (code < 32 || code > 126) {
      hiddenChars.push(`pos ${i}: hex ${code.toString(16).toUpperCase()}`);
    }
  }
  
  let info = `Length: ${length}, Masked: "${start}...${end}"`;
  if (isMasked) {
    info += ` | ❌ CRITICAL: KEY IS MASKED. You cannot copy the masked version (sk-proj-****) from the list. You MUST click 'Create new secret key' and immediately copy the code from the popup before it disappears.`;
  }
  if (isDummy) {
    info += ` | ❌ CRITICAL: DUMMY KEY DETECTED. The key contains placeholder text.`;
  }
  if (isProbablyOpenAIButMissingS) {
    info += ` | ❌ CRITICAL: OpenAI key starts with "k-proj-" but MUST start with "sk-proj-". You are likely missing the 's' at the beginning.`;
  }
  if (hiddenChars.length > 0) {
    info += ` | ⚠️ WARNING: ${hiddenChars.length} hidden chars found (${hiddenChars.slice(0, 3).join(", ")})`;
  }
  return info;
}

let _openai: OpenAI | null = null;
let _openaiFoundVar = "none";
let _lastOpenAIKey = "";

function getOpenAI() {
  const searchKeys = ["OPENAI_KEY", "OPENAI_API_KEY", "OpenAI_API_KEY", "VITE_OPENAI_API_KEY"];
  let currentKey = "";
  let currentVar = "none";

  for (const key of searchKeys) {
    const val = process.env[key];
    const cleaned = cleanKey(val);
    if (cleaned) {
      currentKey = cleaned;
      currentVar = key;
      break; 
    }
  }

  // If the key in environment has changed, reset the client
  if (currentKey !== _lastOpenAIKey) {
    _openai = null;
    _lastOpenAIKey = currentKey;
    _openaiFoundVar = currentVar;
  }

  if (!_openai && currentKey) {
    const portkey = getPortkey();
    const pkKey = process.env.PORTKEY_API_KEY?.trim();
    if (portkey && pkKey && pkKey.startsWith("pk-")) {
      console.log("[AI] Initializing OpenAI via Portkey");
      _openai = portkey as any;
    } else {
      console.log(`[AI] SUCCESS: Initializing OpenAI with key from ${_openaiFoundVar}. ${getDiagnosticInfo(currentKey)}`);
      _openai = new OpenAI({ apiKey: currentKey });
    }
  }
  return _openai;
}

let _gemini: GoogleGenAI | null = null;
let _geminiFoundVar = "none";
let _lastGeminiKey = "";

function getGemini(): GoogleGenAI | null {
  const searchKeys = [
    "VITE_GEMINI_API_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "GOOGLE_GENAI_API_KEY",
    "AI_API_KEY",
  ];

  let currentKey = "";
  let currentVar = "none";

  for (const key of searchKeys) {
    const val = process.env[key];
    const cleaned = cleanKey(val);
    if (cleaned) {
      currentKey = cleaned;
      currentVar = key;
      break;
    }
  }

  // If the key in environment has changed, reset the client
  if (currentKey !== _lastGeminiKey) {
    _gemini = null;
    _lastGeminiKey = currentKey;
    _geminiFoundVar = currentVar;
  }

  if (!_gemini && currentKey) {
    console.log(`[AI] SUCCESS: Initializing Gemini with key from ${_geminiFoundVar}. ${getDiagnosticInfo(currentKey)}`);
    _gemini = new GoogleGenAI({
      apiKey: currentKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    // List models for diagnostic purposes asynchronously
    (async () => {
      try {
        const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
          headers: {
            "x-goog-api-key": currentKey,
          },
        });
        if (response.ok) {
          const data = await response.json();
          const modelList = data.models?.map((m: any) => m.name.replace("models/", "")).join(", ");
          console.log(`[AI] Gemini Auth Check: SUCCESS. Available Models: ${modelList}`);
        } else {
          const errData = await response.json().catch(() => ({}));
          console.error(`[AI] Gemini Auth Check: FAILED. Status: ${response.status}. Reason: ${JSON.stringify(errData)}`);
        }
      } catch (e) {
        console.warn("[AI] Gemini Auth Check: NETWORK_ERROR", e);
      }
    })();
  }
  return _gemini;
}

export async function rerankDocuments(query: string, documents: { text: string; [key: string]: any }[]) {
  const portkeyApiKey = cleanKey(process.env.PORTKEY_API_KEY);
  const cohereVirtualKey = cleanKey(process.env.PORTKEY_COHERE_VIRTUAL_KEY);

  if (!portkeyApiKey || !cohereVirtualKey) {
    console.log("[RAG Audit] Skipping rerank - Portkey keys missing or empty.");
    return [...documents].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5);
  }

  // Diagnostic (masked)
  console.log(`[RAG Audit] Reranking with Portkey. Virtual Key Masked: ${cohereVirtualKey.substring(0, 4)}...${cohereVirtualKey.slice(-4)}`);

  try {
    const response = await fetch(
      "https://api.portkey.ai/v1/rerank",
      {
        method: "POST",
        headers: {
          "x-portkey-api-key": portkeyApiKey,
          "x-portkey-virtual-key": cohereVirtualKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: RERANK_MODEL,
          query: query,
          documents: documents.map(d => d.text),
          top_n: 5,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Rerank failed: ${response.statusText}`);
    }

    const data = await response.json();
    const rerankedMatches = data.results.map((result: any) => documents[result.index]);
    return rerankedMatches;
  } catch (error) {
    console.error("Portkey Rerank error:", error);
    return [...documents].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5);
  }
}

export type Sentiment = "positive" | "neutral" | "negative";

// High-signal lexicon for an instant, zero-cost first pass (covers obvious cases
// and emoji). Ambiguous / non-English messages fall through to a tiny LLM call.
const SENT_POSITIVE = /\b(thank|thanks|great|awesome|perfect|love|loved|excellent|amazing|good|helpful|nice|works|worked|solved|happy|brilliant|wonderful)\b|😊|😀|👍|❤|🙏|🎉/i;
const SENT_NEGATIVE = /\b(bad|terrible|awful|hate|useless|broken|wrong|angry|frustrat\w*|disappoint\w*|refund|cancel|worst|stupid|annoying|rubbish|scam|never works?|doesn'?t work|not working)\b|😠|😡|👎|💢|😤/i;

/**
 * Classify the sentiment of a customer message. Lexicon fast-path first (free,
 * deterministic); ambiguous or non-English text falls back to a 1-word LLM
 * classification so it works across the 95+ supported languages. Always resolves
 * (never throws) — defaults to "neutral" — so it is safe to call fire-and-forget.
 */
export async function analyzeSentiment(text: string): Promise<Sentiment> {
  const t = (text || "").trim();
  if (!t) return "neutral";

  const pos = SENT_POSITIVE.test(t);
  const neg = SENT_NEGATIVE.test(t);
  if (pos && !neg) return "positive";
  if (neg && !pos) return "negative";

  const prompt = `Classify the sentiment of this customer support message as exactly one lowercase word: positive, negative, or neutral.\n\nMessage: """${t.slice(0, 500)}"""\n\nSentiment:`;
  const read = (raw: string): Sentiment | null => {
    const w = raw.toLowerCase();
    if (w.includes("positive")) return "positive";
    if (w.includes("negative")) return "negative";
    if (w.includes("neutral")) return "neutral";
    return null;
  };

  try {
    const gemini = getGemini();
    if (gemini) {
      const r = await gemini.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: { maxOutputTokens: 4 },
      });
      const out = read(r.text || "");
      if (out) return out;
    }
    const openai = getOpenAI();
    if (openai) {
      const r = await (openai as any).chat.completions.create({
        model: process.env.PORTKEY_MODEL || "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 4,
        temperature: 0,
      });
      const out = read(r.choices?.[0]?.message?.content || "");
      if (out) return out;
    }
  } catch (e) {
    console.warn("[Sentiment] LLM classification failed, defaulting to neutral:", e);
  }
  return "neutral";
}

export async function embedText(text: string) {
  // Cache layer: identical text → identical embedding. Big win for repeated
  // queries. No-op when Redis isn't configured.
  const ck = `emb:${EMBEDDING_PROVIDER}:${cacheKey(text)}`;
  const cached = await cacheGet<number[]>(ck);
  if (cached && cached.length === EMBEDDING_DIMENSION) return cached;

  const maxAttempts = 3;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (EMBEDDING_PROVIDER === "openai") {
        const openai = getOpenAI();
        if (!openai) {
          throw new Error("OpenAI is configured as the EMBEDDING_PROVIDER, but OpenAI API key is not available or invalid.");
        }
        const response = await (openai as any).embeddings.create({
          model: "text-embedding-3-small",
          input: text,
        });
        const embedding = response.data[0].embedding as number[];
        if (!embedding || embedding.length === 0) {
          throw new Error("OpenAI returned an empty embedding.");
        }
        await cacheSet(ck, embedding, EMBED_CACHE_TTL);
        return embedding;
      } else {
        const gemini = getGemini();
        if (!gemini) {
          throw new Error("Gemini is configured as the EMBEDDING_PROVIDER, but Gemini API client is not available.");
        }
        const response = await gemini.models.embedContent({ 
          model: "text-embedding-004", 
          contents: [text] 
        });
        const values = response.embeddings?.[0]?.values;
        if (!values || values.length === 0) {
          throw new Error("Gemini returned an empty embedding.");
        }
        await cacheSet(ck, values, EMBED_CACHE_TTL);
        return values;
      }
    } catch (e: any) {
      lastError = e;
      console.warn(`[AI] Embedding attempt ${attempt}/${maxAttempts} failed using ${EMBEDDING_PROVIDER}:`, e.message || e);
      if (attempt < maxAttempts) {
        // Sleep 200ms before retry
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
  }

  throw new Error(`Failed to generate embedding after ${maxAttempts} attempts using provider '${EMBEDDING_PROVIDER}'. Original error: ${lastError?.message || String(lastError)}`);
}

/**
 * Embed many texts efficiently. OpenAI accepts an array input and returns one
 * embedding per item in a single request, so we batch instead of issuing one
 * request per chunk. Gemini is embedded per-item with capped concurrency.
 * Returns embeddings aligned to input order; a failed item yields an empty array.
 */
export async function embedTexts(texts: string[], batchSize = 96): Promise<number[][]> {
  if (texts.length === 0) return [];
  const results: number[][] = texts.map(() => [] as number[]);

  if (EMBEDDING_PROVIDER === "openai") {
    const openai = getOpenAI();
    if (!openai) throw new Error("OpenAI is configured as EMBEDDING_PROVIDER, but no OpenAI client is available.");

    for (let start = 0; start < texts.length; start += batchSize) {
      const batch = texts.slice(start, start + batchSize);
      let lastError: any = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const response = await (openai as any).embeddings.create({
            model: "text-embedding-3-small",
            input: batch,
          });
          for (let i = 0; i < batch.length; i++) {
            results[start + i] = response.data[i].embedding as number[];
          }
          lastError = null;
          break;
        } catch (e: any) {
          lastError = e;
          console.warn(`[AI] Batch embed attempt ${attempt}/3 failed (items ${start}-${start + batch.length}):`, e.message || e);
          if (attempt < 3) await new Promise(r => setTimeout(r, 300 * attempt));
        }
      }
      if (lastError) throw new Error(`Batch embedding failed: ${lastError.message || String(lastError)}`);
    }
    return results;
  }

  // Gemini: embed per item (reuses embedText's retry logic), capped concurrency.
  const concurrency = 5;
  for (let start = 0; start < texts.length; start += concurrency) {
    const slice = texts.slice(start, start + concurrency);
    const embedded = await Promise.all(slice.map(t => embedText(t).catch(() => [] as number[])));
    for (let i = 0; i < embedded.length; i++) results[start + i] = embedded[i];
  }
  return results;
}

/**
 * Like upsertChunks but embeds in batches (one request per ~96 chunks) instead
 * of one request per chunk. Throws on failure so the ingestion pipeline can mark
 * the source failed and retry. Returns the count of vectors upserted.
 */
export async function upsertChunksBatched(
  projectId: string,
  chunks: { text: string; metadata: any }[],
  opts: { batchSize?: number; onProgress?: (done: number, total: number) => Promise<void> | void } = {}
) {
  if (chunks.length === 0) return { upserted: 0 };
  const index = pineconeIndex;
  const batchSize = opts.batchSize ?? 96;
  const total = chunks.length;
  let upserted = 0;
  let processed = 0;

  // Embed + upsert one batch at a time so progress can be reported and partial
  // work survives a mid-run failure (the next retry re-upserts deterministically).
  for (let start = 0; start < chunks.length; start += batchSize) {
    const batch = chunks.slice(start, start + batchSize);
    const embeddings = await embedTexts(batch.map(c => c.text), batchSize);

    const validVectors = batch
      .map((chunk, i) => {
        const hash = crypto.createHash("sha256").update(chunk.text).digest("hex").substring(0, 16);
        const sourceUrlOrTitle = chunk.metadata.url || chunk.metadata.source || "internal";
        return {
          id: `${projectId}-${hash}-${start + i}`,
          values: embeddings[i] || [],
          metadata: { ...chunk.metadata, source: sourceUrlOrTitle, text: chunk.text, projectId },
        };
      })
      .filter(v => {
        if (!v.values || v.values.length === 0) return false;
        if (v.values.length !== EMBEDDING_DIMENSION) {
          console.error(`[AI] DIMENSION_MISMATCH: vector ${v.id} has ${v.values.length}, expected ${EMBEDDING_DIMENSION}. Skipping.`);
          return false;
        }
        return true;
      });

    if (validVectors.length > 0) {
      await index.namespace(projectId).upsert({ records: validVectors } as any);
      upserted += validVectors.length;
    }
    processed += batch.length;
    if (opts.onProgress) await opts.onProgress(processed, total);
  }

  console.log(`[AI] Batched upsert: ${upserted}/${total} chunks to Pinecone.`);
  return { upserted };
}

export async function upsertChunks(projectId: string, chunks: { text: string; metadata: any }[]) {
  try {
    const index = pineconeIndex;

    const vectors = await Promise.all(
      chunks.map(async (chunk, i) => {
        let values: number[] = [];
        try {
          values = await embedText(chunk.text);
        } catch (embedErr) {
          console.warn("[AI] Failed to embed text chunk during upsert:", embedErr);
        }
        
        // Generate a deterministic hash based on text content to avoid duplicate indexing
        const hash = crypto.createHash("sha256").update(chunk.text).digest("hex").substring(0, 16);
        const chunkId = `${projectId}-${hash}-${i}`;
        const sourceUrlOrTitle = chunk.metadata.url || chunk.metadata.source || "internal";

        return {
          id: chunkId,
          values,
          metadata: {
            ...chunk.metadata,
            source: sourceUrlOrTitle,
            text: chunk.text,
            projectId,
          },
        };
      })
    );

    // Filter, validate, and only upload if dimension matches EMBEDDING_DIMENSION
    const validVectors = vectors.filter(v => {
      if (!v.values || v.values.length === 0) {
        return false;
      }
      if (v.values.length !== EMBEDDING_DIMENSION) {
        console.error(`[AI] DIMENSION_MISMATCH: Generated vector ${v.id} has dimension ${v.values.length}, but expected ${EMBEDDING_DIMENSION}. Skipping.`);
        return false;
      }
      return true;
    });

    if (validVectors.length > 0) {
      await index.namespace(projectId).upsert({ records: validVectors });
      console.log(`[AI] Successfully upserted ${validVectors.length} chunks to Pinecone vector database.`);
    } else {
      console.warn("[AI] No valid vector embedding with matching dimension could be created for chunks. Stored content in main database only.");
    }
  } catch (error) {
    console.error("[AI] Error upserting chunks to Pinecone vector store (falling back gracefully to Prisma DB storage):", error);
    // Suppress error so training action finishes successfully, storing documents in SQLite/MySQL knowledgeSource for keyword search.
  }
}

export async function deleteSourceChunks(projectId: string, sourceValue: string) {
  const index = pineconeIndex;
  // We specify the namespace and filter by either url or source field to prevent orphan chunks
  try {
    await index.namespace(projectId).deleteMany({
      filter: {
        "$or": [
          { source: { "$eq": sourceValue } },
          { url: { "$eq": sourceValue } }
        ]
      }
    });
    console.log(`[AI] Deleted chunks for source matching: "${sourceValue}" in project: ${projectId}`);
  } catch (error) {
    console.error(`[AI] Error deleting chunks for source ${sourceValue}:`, error);
  }
}

export async function rewriteStandaloneQuery(
  query: string,
  history: { role: string, content: string }[]
): Promise<string> {
  if (!history || history.length === 0) {
    return query;
  }

  const lastTurns = history.slice(-6); // last ~4-6 turns of recent context
  const historyText = lastTurns.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");

  const prompt = `Given the conversation history and the latest user query, rewrite the latest query to be a self-contained, standalone question (in the same language as the query). This rewritten question should be suitable for a vector database and keyword search.

CONVERSATION HISTORY:
${historyText}

LATEST QUERY:
${query}

Rules:
1. Output ONLY the rewritten standalone question. Do NOT include any preamble, introduction, markdown, or explanation.
2. If the latest query is already self-contained, or cannot be refined or does not refer to history, output the original query exactly.
3. Keep it highly concise.

REWRITTEN STANDALONE QUESTION:`;

  try {
    const gemini = getGemini();
    const openai = getOpenAI();

    const task = (async () => {
      if (gemini) {
        try {
          const response = await gemini.models.generateContent({
            model: "gemini-2.0-flash",
            contents: prompt,
            config: {
              maxOutputTokens: 80,
            }
          });
          const text = response.text?.trim();
          if (text) return text;
        } catch (err: any) {
          console.error("[Query Rewrite] Gemini generation failed, trying OpenAI:", err.message || err);
        }
      }

      if (openai) {
        try {
          const response = await (openai as any).chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 80,
            temperature: 0.1,
          });
          const text = response.choices?.[0]?.message?.content?.trim();
          if (text) return text;
        } catch (err: any) {
          console.error("[Query Rewrite] OpenAI generation failed:", err.message || err);
        }
      }

      return query;
    })();

    // 4-second timeout to return the original query if LLM is slow or stalls
    const timeoutPromise = new Promise<string>((resolve) =>
      setTimeout(() => resolve(query), 4000)
    );

    return await Promise.race([task, timeoutPromise]);
  } catch (error: any) {
    console.error("[Query Rewrite] Error in query rewriting, returning original query:", error.message || error);
    return query;
  }
}

/**
 * Multi-query expansion (opt-in via RAG_MULTI_QUERY=1). Generates a few alternative
 * phrasings of the search query to widen retrieval recall. Returns [] when disabled
 * or on any failure, so callers can simply spread the result with no behaviour change.
 */
export async function expandQueries(query: string, n = 2): Promise<string[]> {
  if (process.env.RAG_MULTI_QUERY !== "1") return [];
  try {
    const gemini = getGemini();
    if (!gemini) return [];
    const resp: any = await gemini.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Rewrite the search query into ${n} alternative phrasings a knowledge base might match. Return ONLY the rewrites, one per line, no numbering or commentary.\n\nQuery: ${query}`,
    });
    const text =
      resp?.text ??
      resp?.candidates?.[0]?.content?.parts?.[0]?.text ??
      "";
    return String(text)
      .split("\n")
      .map((s: string) => s.replace(/^[-*\d.\s]+/, "").trim())
      .filter(Boolean)
      .slice(0, n);
  } catch (e) {
    console.warn("[Multi-Query] expansion failed:", e);
    return [];
  }
}

export async function* streamRAG(
  projectId: string,
  query: string,
  systemPrompt?: string,
  history: { role: string, content: string }[] = [],
  modelPreference?: string,
  sourceFilter?: { urls?: string[]; types?: ('web' | 'file' | 'youtube' | 'text')[] },
  responseLanguage?: string
) {
  if (isPlainGreeting(query)) {
    yield "Hi! How can I help you today?";
    return;
  }

  // Multilingual: respond in the user's language (auto-detected) unless the
  // project pins a fixed language via settings.language.
  const langInstruction = languageDirective(query, responseLanguage);

  // PREDEFINED Q&A INTERCEPTION LAYER
  if (projectId !== "demo-project") {
    try {
      const { prisma } = await import("~/database/db.server");
      const qas = await prisma.knowledgeQA.findMany({
        where: { projectId }
      });

      if (qas && qas.length > 0) {
        const getNormalizedText = (txt: string) => {
          return txt.toLowerCase().trim().replace(/[?.,!：；？，。！]+/g, " ").replace(/\s+/g, " ").trim();
        };

        const normQuery = getNormalizedText(query);

        // Score-based matching to choose the most optimal Q&A pair
        let bestMatch: any = null;
        let highestScore = 0;

        for (const qa of qas) {
          const normQuestion = getNormalizedText(qa.question);
          let score = 0;

          if (normQuery === normQuestion) {
            score = 100; // Perfect direct match
          } else if (normQuery.length >= 4 && normQuestion.includes(normQuery)) {
            score = 80;  // Query is part of a custom question
          } else if (normQuestion.length >= 4 && normQuery.includes(normQuestion)) {
            score = 70;  // Custom question is part of the query
          }

          if (score > highestScore) {
            highestScore = score;
            bestMatch = qa;
          }
        }

        if (bestMatch && highestScore >= 70) {
          console.log(`[QA Match] Custom answer match found for question: "${bestMatch.question}" (Score: ${highestScore})`);
          
          // Increment triggerCount and update lastUsedAt asynchronously
          prisma.knowledgeQA.update({
            where: { id: bestMatch.id },
            data: {
              triggerCount: { increment: 1 },
              lastUsedAt: new Date()
            }
          }).catch((err: any) => console.error("[QA Stats Update Error] Failed:", err));

          // Yield classification metadata first
          yield `METADATA:${JSON.stringify({ source: "qa" })}`;

          // Yield response with a highly satisfying typing simulation speed
          const words = bestMatch.answer.split(" ");
          for (let i = 0; i < words.length; i++) {
            yield words[i] + (i < words.length - 1 ? " " : "");
            await new Promise(resolve => setTimeout(resolve, 15));
          }
          return;
        }
      }
    } catch (qaErr) {
      console.error("[QA Lookup Error] Failed to perform QA database lookup:", qaErr);
    }
  }

  const isDemo = projectId === "demo-project";
  const fallbackMessage = isDemo
    ? "I am specialized only in SiteGist platform support. I can help you with pricing, features, crawling, or policies. For other topics, please contact our human support team."
    : "I don't have information about that. Please contact our support team for more help.";

  let context = "";
  let citationMetadata: { url?: string; title?: string }[] = [];
  
  console.log(`[RAG Audit] Stage 1: Starting RAG for project: ${projectId}`);
  
  if (!isDemo) {
    const endRetrieval = startTimer("rag.retrieval", { projectId });
    try {
      const index = pineconeIndex;
      const { prisma } = await import("~/database/db.server");

      // Advanced Query Rewriting for conversation
      const searchTerms = await rewriteStandaloneQuery(query, history);
      console.log(`[Query Rewrite] Orig: "${query}" -> Rewritten standalone query: "${searchTerms}"`);

      console.log(`[Hybrid Search] Stage 2: Parallel Search (Vector + Keyword)`);
      
      // 1. Vector Search (Pinecone)
      let vectorResults: any = { matches: [] };
      let vectorTask = Promise.resolve({ matches: [] });
      try {
        const embedding = await embedText(searchTerms);
        const pineconeFilter: Record<string, any> = {
          projectId: { $eq: projectId },
        };

        if (sourceFilter?.urls && sourceFilter.urls.length > 0) {
          pineconeFilter.source = { $in: sourceFilter.urls };
        }

        vectorTask = index.namespace(projectId).query({
          vector: embedding,
          topK: 20,
          includeMetadata: true,
          filter: pineconeFilter,
        }).catch((err: any) => {
          console.warn("[Hybrid Search] Pinecone vector search failed inside promise:", err);
          return { matches: [] };
        });
      } catch (err) {
        console.warn("[Hybrid Search] Pinecone initialization/embedding failed during search:", err);
      }

      // 2. Keyword Search (PostgreSQL Full-Text Search via tsvector and websearch_to_tsquery)
      const keywordTask = (!searchTerms || !searchTerms.trim())
        ? Promise.resolve([])
        : prisma.$queryRaw<any[]>`
            SELECT "content", "source", "title",
                   ts_rank("search_vector", websearch_to_tsquery('english', ${searchTerms})) AS "rank"
            FROM "KnowledgeSource"
            WHERE "projectId" = ${projectId}
              AND "search_vector" @@ websearch_to_tsquery('english', ${searchTerms})
            ORDER BY "rank" DESC
            LIMIT 5
          `.catch((err: any) => {
            console.error("[Hybrid Search] PostgreSQL Full-Text Search failed inside promise:", err);
            return [];
          });

      const [resolvedVectorResults, keywordResults] = await Promise.all([vectorTask, keywordTask]);
      vectorResults = resolvedVectorResults || { matches: [] };

      // Multi-query expansion (opt-in): widen recall by also searching alternative
      // phrasings of the query and merging in any new vector matches. Default path
      // (RAG_MULTI_QUERY unset) is untouched.
      if (process.env.RAG_MULTI_QUERY === "1") {
        try {
          const expansions = await expandQueries(searchTerms, 2);
          if (expansions.length > 0) {
            const expFilter: Record<string, any> = { projectId: { $eq: projectId } };
            if (sourceFilter?.urls && sourceFilter.urls.length > 0) expFilter.source = { $in: sourceFilter.urls };
            const expEmbeddings = await embedTexts(expansions);
            const extra = await Promise.all(
              expEmbeddings.map(vec =>
                vec.length === EMBEDDING_DIMENSION
                  ? index.namespace(projectId).query({ vector: vec, topK: 10, includeMetadata: true, filter: expFilter }).catch(() => ({ matches: [] }))
                  : Promise.resolve({ matches: [] })
              )
            );
            if (!vectorResults.matches) vectorResults.matches = [];
            const seenIds = new Set((vectorResults.matches || []).map((m: any) => m.id));
            for (const r of extra) {
              for (const m of (r as any).matches || []) {
                if (m.id && !seenIds.has(m.id)) { seenIds.add(m.id); vectorResults.matches.push(m); }
              }
            }
            console.log(`[Multi-Query] ${expansions.length} expansions -> ${vectorResults.matches.length} total vector matches.`);
          }
        } catch (e) {
          console.warn("[Multi-Query] merge failed (continuing with base results):", e);
        }
      }

      console.log(`[Hybrid Search] Vector: ${vectorResults.matches?.length || 0}, Keyword: ${keywordResults?.length || 0}`);

      // Merge and Deduplicate
      const seen = new Set();
      const initialMatches: any[] = [];

      // Add keyword results first (high precision for specific queries)
      keywordResults?.forEach(source => {
        if (!source.content) return;
        const key = source.content.substring(0, 100);
        if (!seen.has(key)) {
          seen.add(key);
          initialMatches.push({
            text: source.content,
            url: source.source,
            title: source.title,
            score: 1.0, // High score for direct keyword match
            method: "keyword"
          });
        }
      });

      // Add vector results
      vectorResults.matches?.forEach((match: any) => {
        if ((match.score || 0) < VECTOR_SCORE_THRESHOLD) return;
        const text = (match.metadata as any)?.text;
        if (!text) return;
        const key = text.substring(0, 100);
        if (!seen.has(key)) {
          seen.add(key);
          initialMatches.push({
            text,
            url: (match.metadata as any)?.url,
            title: (match.metadata as any)?.title,
            score: match.score || 0,
            method: "vector"
          });
        }
      });

      if (initialMatches.length === 0) {
        console.warn(`[Hybrid Search] Stage 3 WARNING: Zero matches found for project ${projectId}.`);
        console.log(`[Zero Context Guard] No knowledge sources found for projectId: ${projectId}. Short-circuiting with fallback message.`);
        yield `METADATA:${JSON.stringify({ source: "knowledge" })}`;
        yield fallbackMessage;
        return;
      }

      // Advanced Reranking Layer (Cohere v3)
      console.log(`[Hybrid Search] Stage 4: Reranking ${initialMatches.length} documents...`);
      const rankedSources = await rerankDocuments(query, initialMatches);
      
      if (rankedSources.length === 0) {
        console.log(`[Zero Context Guard] Reranked sources are empty for projectId: ${projectId}. Short-circuiting with fallback message.`);
        yield `METADATA:${JSON.stringify({ source: "knowledge" })}`;
        yield fallbackMessage;
        return;
      }

      citationMetadata = rankedSources
        .filter((s: any) => s.url)
        .map((s: any) => ({ url: s.url, title: s.title }))
        .slice(0, 3); // Top 3 unique citations

      context = rankedSources
        .map((s: any, i: number) => `[Document ${i+1}]: ${s.text}\nSource: ${s.title || 'Knowledge Base'} (${s.url || 'Internal'})\n---`)
        .join("\n\n");

      const rerankEnabled = !!(process.env.PORTKEY_API_KEY && process.env.PORTKEY_COHERE_VIRTUAL_KEY);
      endRetrieval({
        ok: true,
        candidates: initialMatches.length,
        ranked: rankedSources.length,
        citations: citationMetadata.length,
        rerank: rerankEnabled,
        multiQuery: process.env.RAG_MULTI_QUERY === "1",
      });
    } catch (e) {
      console.error("[Hybrid Search] Retrieval failed, short-circuiting with fallback message:", e);
      captureException(e, { where: "streamRAG.retrieval", projectId });
      endRetrieval({ ok: false });
      yield `METADATA:${JSON.stringify({ source: "knowledge" })}`;
      yield fallbackMessage;
      return;
    }
  } else {
    console.log(`[RAG Audit] Stage 1: Operating in Demo Mode. Providing SiteGist System Knowledge.`);
    context = `
About SiteGist:
SiteGist is a powerful AI Chatbot builder and lead generation platform. It allows users to crawl their websites, train an AI agent in minutes, and embed a floating chatbot that handles 24/7 sales, lead capture, and appointment booking.

Key Features:
- AI-powered answers: Instant, accurate responses derived from your website content.
- Multi-channel deployment: Embed on your website via a script tag or use it as a standalone landing page.
- Lead Generation: Intelligently captures visitor contact info (name, email, phone) with customizable forms.
- Human Handoff: Seamlessly notifies your team via Slack or Zendesk when a human agent is needed.
- Automatic content syncing: SiteGist keeps your chatbot updated as you change your website content.
- Integrations: Supports Notion, Google Drive, Slack, Zendesk, and Zapier for syncing data and notifications.

Pricing & Subscription Plans:
- Free Starter: 1 chatbot project, 50 message credits/month, basic crawling.
- Pro Plan ($19/month): 5 chatbot projects, 1,000 message credits/month, priority support, and advanced integrations (Notion, Google Drive, Slack, Zapier).
- Enterprise: Custom pricing for unlimited projects, white-label options, and dedicated account management.

Refund Policy:
SiteGist offers a 14-day no-questions-asked refund policy for all subscription plans if you are not satisfied with the service.

How it works:
1. Signup and create a new project.
2. Enter your website URL or upload documents.
3. SiteGist "trains" the AI on this content.
4. Customize the widget and copy the snippet to your site.
    `;
  }

  // Yield citations first so UI can prepare
  if (citationMetadata.length > 0) {
    yield `METADATA:${JSON.stringify({ citations: citationMetadata })}`;
  }

  // AGENTIC AI ACTIONS: let the project's configured tools fetch live data or
  // perform a task (lookup order, book demo, hit your API), then ground the answer
  // on the result. Best-effort — any failure leaves the normal RAG answer intact.
  if (!isDemo) {
    try {
      const { getEnabledActions, runAgenticActions } = await import("./actions.server");
      const projectActions = await getEnabledActions(projectId);
      if (projectActions.length > 0) {
        const wantsOpenAIForActions = !!modelPreference && modelPreference.startsWith("gpt");
        const wantsGeminiForActions = !!modelPreference && modelPreference.startsWith("gemini");
        const outcome = await runAgenticActions({
          projectId,
          query,
          history,
          actions: projectActions,
          openai: getOpenAI(),
          gemini: getGemini(),
          openaiModel: wantsOpenAIForActions ? modelPreference! : (process.env.PORTKEY_MODEL || "gpt-4o-mini"),
          geminiModel: wantsGeminiForActions ? modelPreference! : "gemini-2.0-flash",
        });
        if (outcome && outcome.ran.length > 0) {
          yield `ACTION:${JSON.stringify({ actions: outcome.ran })}`;
          context = `${context}\n\n${outcome.resultsText}`;
        }
      }
    } catch (actErr) {
      console.error("[Agentic Actions] Skipped (continuing with standard RAG):", actErr);
    }
  }

  const promptHistory = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");

  const personaPreamble = isDemo
    ? `You are "Ask SiteGist", the official AI Support Specialist for the SiteGist platform. Answer questions accurately and professionally about SiteGist features, pricing, refund policy, and general platform usage.`
    : `You are an AI assistant for this website. Your identity, scope, and tone are defined entirely by the SYSTEM INSTRUCTIONS below. Do not claim to be any other company or product.`;
  const fallbackLine = isDemo
    ? `I am specialized only in SiteGist platform support. I can help you with pricing, features, crawling, or policies. For other topics, please contact our human support team.`
    : `I don't have information about that in my knowledge base. Please contact our support team for more help.`;
  const prompt = `${personaPreamble}

  SYSTEM INSTRUCTIONS:
  ${systemPrompt || "Provide helpful, accurate answers based only on the knowledge provided."}

  LANGUAGE REQUIREMENT:
  ${langInstruction}

  KNOWLEDGE CONTEXT:
  ${context}

  CONVERSATION HISTORY:
  ${promptHistory}

  STRICT RULES:
  1. BASE YOUR ANSWER ONLY ON THE "KNOWLEDGE CONTEXT" ABOVE AND THE SYSTEM INSTRUCTIONS.
  2. IF THE CONTEXT DOES NOT CONTAIN THE ANSWER, say (translated into the required language): "${fallbackLine}"
  3. DO NOT HALLUCINATE OR INVENT FACTS THAT ARE NOT PRESENT IN THE CONTEXT.
  4. Use professional, concise PLAIN TEXT.
  5. DO NOT use markdown symbols. NO stars (*), NO bolding (**), NO highlights.
  6. Use clean paragraphs or simple dashes (-) for lists.
  7. If the user only greets you, reply briefly and warmly and invite their question.
  8. ALWAYS obey the LANGUAGE REQUIREMENT above for your entire response.

  USER QUERY: ${query}

  RESPONSE:`;

  console.log(`[RAG Audit] Stage 6: Sending prompt to LLM (Length: ${prompt.length} chars)...`);

  const gemini = getGemini();
  const openai = getOpenAI();
  let fullAnswer = "";
  let lastError: any = null;

  // Per-bot model routing. "auto" (or unset) keeps the original fallback behavior.
  const wantsOpenAI = !!modelPreference && modelPreference.startsWith("gpt");
  const wantsGemini = !!modelPreference && modelPreference.startsWith("gemini");
  const geminiModel = wantsGemini ? modelPreference! : "gemini-2.0-flash";
  const openaiModelPref = wantsOpenAI ? modelPreference! : (process.env.PORTKEY_MODEL || "gpt-4o-mini");

  // Add a safety timeout for the entire generation process
  const generationTimeout = setTimeout(() => {
    if (!fullAnswer && !lastError) {
      lastError = { message: "Generation timed out after 30 seconds." };
    }
  }, 30000);

  try {
    yield `METADATA:${JSON.stringify({ source: "knowledge" })}`;
    if (gemini && !(wantsOpenAI && openai)) {
      try {
        console.log(`[RAG Audit] Stage 6: Calling Gemini ${geminiModel} stream...`);
        
        const result = await gemini.models.generateContentStream({
          model: geminiModel,
          contents: prompt,
          config: {
            maxOutputTokens: GEMINI_CHAT_MAX_TOKENS
          }
        });
        
        for await (const chunk of result) {
          try {
            const chunkText = chunk.text;
            if (chunkText) {
              fullAnswer += chunkText;
              yield chunkText;
            }
          } catch (chunkError: any) {
            console.warn("[RAG Audit] Stage 7: Error parsing Gemini chunk:", chunkError);
          }
        }
      } catch (e: any) {
        console.error("[RAG Audit] Stage 6/7 Gemini Error Detail:", e);
        let errorMsg = e.message || String(e);
        const diag = getDiagnosticInfo(process.env[_geminiFoundVar]);
        
        if (errorMsg.includes("API key not valid") || errorMsg.includes("API key expired") || errorMsg.includes("400") || errorMsg.includes("INVALID_ARGUMENT") || errorMsg.includes("key expired")) {
           errorMsg = `[API_KEY_ERROR] Key rejected (EXPIRED or INVALID).
           Diagnostic: ${diag}. 
           
           Action: Create a NEW key at aistudio.google.com/app/apikey and paste it into Settings. Ensure you copy the FULL secret (no stars).`;
        } else if (errorMsg.includes("quota")) {
           errorMsg = `[QUOTA_EXCEEDED] Gemini API quota reached. Please wait a few minutes or use OpenAI.`;
        }
        lastError = { message: errorMsg || "Gemini connection failed" };
      }
    }

    if (openai && !fullAnswer) {
      try {
        const model = openaiModelPref;
        const maxTokens = parseInt(process.env.PORTKEY_MAX_TOKENS || "2048", 10);
        
        console.log(`[RAG Audit] Stage 8: Calling OpenAI ${model}...`);
        const stream = await (openai as any).chat.completions.create({
          model: model,
          stream: true,
          messages: [{ role: "user", content: prompt }],
          max_tokens: maxTokens,
        }, { timeout: 20000 }); // 20s timeout

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            fullAnswer += content;
            yield content;
          }
        }
      } catch (e: any) {
         console.error("[RAG Audit] OpenAI Error:", e);
         let errorMsg = e.message || String(e);
         const diag = getDiagnosticInfo(process.env[_openaiFoundVar]);
         
         if (errorMsg.includes("Invalid API Key") || errorMsg.includes("Incorrect API key") || errorMsg.includes("401") || errorMsg.includes("invalid_api_key")) {
            errorMsg = `[API_KEY_INVALID] OpenAI rejected the key. 
            Diagnostic: ${diag}. 
            Action: 
            1. Go to platform.openai.com/api-keys. 
            2. Click "+ Create new secret key".
            3. Copy the secret IMMEDIATELY. You only get ONE chance to see it!
            4. If you see "sk-proj-****" in a list, it's MASKED. Create a new one.`;
            if (diag.includes("MASKED") || diag.includes("*")) {
              errorMsg += "\n\nCRITICAL: Your key has asterisks (*). You copied the MASKED version. You must click 'Create new secret key' and copy the text shown in the popup!";
            }
         }
         lastError = { message: errorMsg || "OpenAI connection failed" };
      }
    } 
  } finally {
    clearTimeout(generationTimeout);
  }

  if (!fullAnswer) {
    let errorMsg = lastError?.message || "All AI providers failed to respond. Please check your API keys.";
    
    // Proactive check for masked keys if no providers were initialized
    if (!lastError) {
      const allEnvKeys = Object.keys(process.env);
      const aiKeys = allEnvKeys.filter(k => k.includes("OPENAI") || k.includes("GEMINI") || k.includes("GOOGLE_API"));
      for (const k of aiKeys) {
        const val = process.env[k];
        if (val && (val.includes("*") || val.includes("•") || (val.includes("...") && val.length < 50))) {
          errorMsg = `[MASKED_KEY_DETECTED] Your ${k} contains masking characters (* or • or ...). 
          Diagnostic: ${getDiagnosticInfo(val)}.
          Action: You copied a dashboard placeholder! 
          1. Go to the dashboard. 
          2. Click the 'Copy' button or the 'Eye' icon to reveal the secret. 
          3. Paste the FULL secret key into Settings.`;
          break;
        }
      }
    }

    // Check if it's a common key mismatch
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.AI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (geminiKey?.startsWith("sk-")) {
      errorMsg += " (Hint: Your Gemini API Key starts with 'sk-', which looks like an OpenAI key. Please swap them in Settings.)";
    } else if (openaiKey?.startsWith("AIza")) {
      errorMsg += " (Hint: Your OpenAI API Key starts with 'AIza', which looks like a Gemini key. Please swap them in Settings.)";
    }

    // Route detailed operator diagnostics to server-side logs only
    console.error(`[RAG ERROR DIAGNOSTICS] Stream failed: ${errorMsg}`);
    
    captureException(new Error("AI generation failed"), { where: "streamRAG.generation", projectId });
    yield `[ERROR] ${USER_FACING_ERROR}`;
    return;
  }
}

/**
 * Simple AI generator for tools (no RAG)
 */
export async function* generateSimpleAIStream(prompt: string) {
  const gemini = getGemini();
  const openai = getOpenAI();
  let fullAnswer = "";
  let lastError: any = null;

  try {
    if (gemini) {
      try {
        const result = await gemini.models.generateContentStream({
          model: "gemini-2.0-flash",
          contents: prompt,
          config: {
            maxOutputTokens: GEMINI_SIMPLE_MAX_TOKENS
          }
        });
        for await (const chunk of result) {
          const text = chunk.text;
          if (text) {
            fullAnswer += text;
            yield text;
          }
        }
      } catch (e: any) {
        console.error("[Simple AI] Gemini Error:", e);
        lastError = e;
      }
    }

    if (openai && !fullAnswer) {
      try {
        const stream = await (openai as any).chat.completions.create({
          model: process.env.PORTKEY_MODEL || "gpt-4o-mini",
          stream: true,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 2048,
        });

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            fullAnswer += content;
            yield content;
          }
        }
      } catch (e: any) {
        console.error("[Simple AI] OpenAI Error:", e);
        lastError = e;
      }
    }
  } catch (err) {
    console.error("[Simple AI] Fatal Error:", err);
    lastError = err;
  }

  if (!fullAnswer && lastError) {
    yield `[ERROR] AI Provider failed: ${lastError.message || String(lastError)}`;
  } else if (!fullAnswer) {
    yield `[ERROR] No AI providers responded. Check your API keys.`;
  }
}

/**
 * Generates smart follow-up questions based on the query and AI response.
 */
export async function generateFollowUpSuggestions(query: string, answer: string): Promise<string[]> {
  const prompt = `Based on this question and answer, suggest exactly 3 short follow-up questions the user might ask next. Return ONLY a JSON array of 3 strings, no explanation.

Question: ${query}
Answer: ${answer}

Example output: ["Is there a free trial?", "Can I cancel anytime?", "Do you offer annual billing?"]`;

  const gemini = getGemini();
  const openai = getOpenAI();
  let rawText = "";

  try {
    if (gemini) {
      console.log("[AI] Generating suggestions using Gemini...");
      const resp = await gemini.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: {
          maxOutputTokens: 120,
        }
      });
      rawText = resp.text || "";
    } else if (openai) {
      console.log("[AI] Generating suggestions using OpenAI...");
      const resp = await (openai as any).chat.completions.create({
        model: process.env.PORTKEY_MODEL || "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 120,
      });
      rawText = resp.choices[0]?.message?.content || "";
    }

    if (!rawText) return [];

    let cleanJson = rawText.trim();
    // Strip markdown code blocks if any
    if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/^```[a-zA-Z]*\r?\n?/, "");
      cleanJson = cleanJson.replace(/```$/, "");
      cleanJson = cleanJson.trim();
    }

    const parsed = JSON.parse(cleanJson);
    if (Array.isArray(parsed)) {
      return parsed.slice(0, 3).map(item => String(item).trim());
    }
  } catch (err) {
    console.warn("[Suggestions Generation Error] Failed:", err);
  }
  return [];
}


