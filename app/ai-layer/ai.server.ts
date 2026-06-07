import OpenAI from "openai";
import { pineconeIndex } from "~/lib/pinecone.server";
import { getPortkey } from "./portkey.server";
import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";

const VECTOR_SCORE_THRESHOLD = 0.30;

const GEMINI_CHAT_MAX_TOKENS     = 2048;
const GEMINI_VERIFY_MAX_TOKENS   = 256;
const GEMINI_SIMPLE_MAX_TOKENS   = 1024;

  console.log("AI Server Startup Diagnostic:", {
    hasGemini: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    hasOpenAI: !!(process.env.OPENAI_KEY || process.env.OPENAI_API_KEY || process.env.OpenAI_API_KEY || process.env.VITE_OPENAI_API_KEY),
    hasPortkey: !!(process.env.PORTKEY_API_KEY),
    allKeys: Object.keys(process.env).filter(k => k.includes("KEY") || k.includes("API")).sort()
  });

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
     console.error(`[AI] MASKED_KEY_DETECTED: Your key looks like a placeholder (contains stars, dots, or hidden chars). Length: ${raw.length}. Value: ${raw}`);
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
     console.error(`[AI] MASKED_KEY_REJECTED: Found asterisks or dots in key. Length: ${cleaned.length}`);
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
  // Show more characters to verify prefixes like sk-proj-
  const start = key.substring(0, 12);
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
  
  let info = `Length: ${length}, Start: "${start}"... End: "${end}"`;
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
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${currentKey}`);
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
    return documents.slice(0, 5);
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
          model: "rerank-english-v3.0",
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
    return documents.slice(0, 5);
  }
}

export async function embedText(text: string) {
  const openai = getOpenAI();
  if (openai) {
    try {
      const response = await (openai as any).embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      });
      return response.data[0].embedding as number[];
    } catch (e) {
      console.warn("[AI] OpenAI Embedding failed, attempting Gemini fallback...", e);
    }
  }

  // Fallback to Gemini embedding if possible
  const gemini = getGemini();
  if (gemini) {
    const response = await gemini.models.embedContent({ 
      model: "text-embedding-004", 
      contents: [text] 
    });
    return response.embeddings?.[0]?.values || [];
  }
  throw new Error("No embedding provider available (OpenAI key failed and Gemini not configured)");
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

    // Only upload if we actually got valid non-empty vectors with embedding values (Pinecone requires values of the dimensions matching index)
    const validVectors = vectors.filter(v => v.values && v.values.length > 0);
    if (validVectors.length > 0) {
      await index.namespace(projectId).upsert({ records: validVectors });
      console.log(`[AI] Successfully upserted ${validVectors.length} chunks to Pinecone vector database.`);
    } else {
      console.warn("[AI] No valid vector embedding could be created for chunks. Stored content in main database only.");
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

export async function* streamRAG(
  projectId: string,
  query: string,
  systemPrompt?: string,
  history: { role: string, content: string }[] = [],
  modelPreference?: string,
  sourceFilter?: { urls?: string[]; types?: ('web' | 'file' | 'youtube' | 'text')[] }
) {
  // IF THE USER SAYS "hi" OR GREETS YOU, REPLY EXACTLY WITH: "Hi! How can I help you today?"
  const normalizedQuery = query.toLowerCase().trim().replace(/[?!.]+$/, "");
  const greetings = ["hi", "hello", "hey", "hola", "greetings", "hi there", "hello there", "hi!", "hi.", "hi?", "pricing plans", "pricing"];
  if (greetings.includes(normalizedQuery) || /^(hi|hello|hey)\b/i.test(normalizedQuery) && normalizedQuery.length < 12) {
    if (normalizedQuery.includes("pricing")) {
      yield "SiteGist offers three plans: \n- Free: 1 project, 50 queries.\n- Pro ($19/mo): 5 projects, 1,000 queries.\n- Enterprise: Custom volume.\n\nHow can I help you with these today?";
    } else {
      yield "Hi! How can I help you today?";
    }
    return;
  }

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

  let context = "";
  let citationMetadata: { url?: string; title?: string }[] = [];
  
  console.log(`[RAG Audit] Stage 1: Starting RAG for project: ${projectId}`);
  
  if (projectId !== "demo-project") {
    try {
      const index = pineconeIndex;
      const { prisma } = await import("~/database/db.server");
      
      // Advanced Query Rewriting for conversation
      const searchTerms = history.length > 0 
        ? `${history.map(m => m.content).join(" ")} ${query}`.slice(-600)
        : query;

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
      const keywordTask = (!query || !query.trim())
        ? Promise.resolve([])
        : prisma.$queryRaw<any[]>`
            SELECT "content", "source", "title",
                   ts_rank(to_tsvector('english', COALESCE("content", '')), websearch_to_tsquery('english', ${query})) AS "rank"
            FROM "KnowledgeSource"
            WHERE "projectId" = ${projectId}
              AND to_tsvector('english', COALESCE("content", '')) @@ websearch_to_tsquery('english', ${query})
            ORDER BY "rank" DESC
            LIMIT 5
          `.catch((err: any) => {
            console.error("[Hybrid Search] PostgreSQL Full-Text Search failed inside promise:", err);
            return [];
          });

      const [resolvedVectorResults, keywordResults] = await Promise.all([vectorTask, keywordTask]);
      vectorResults = resolvedVectorResults || { matches: [] };

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
      }

      // Advanced Reranking Layer (Cohere v3)
      console.log(`[Hybrid Search] Stage 4: Reranking ${initialMatches.length} documents...`);
      const rankedSources = await rerankDocuments(query, initialMatches);
      
      citationMetadata = rankedSources
        .filter((s: any) => s.url)
        .map((s: any) => ({ url: s.url, title: s.title }))
        .slice(0, 3); // Top 3 unique citations

      context = rankedSources
        .map((s: any, i: number) => `[Document ${i+1}]: ${s.text}\nSource: ${s.title || 'Knowledge Base'} (${s.url || 'Internal'})\n---`)
        .join("\n\n");
        
      console.log(`[Hybrid Search] Stage 5: Hybrid Retrieval complete.`);
    } catch (e) {
      console.error("[Hybrid Search] Retrieval failed:", e);
      context = "No specific context available due to a retrieval error.";
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

  const promptHistory = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");

  const isDemo = projectId === "demo-project";
  const identity = isDemo 
    ? `You are "Ask SiteGist", the official AI Support Specialist for the SiteGist platform.
  
  YOUR MISSION:
  Answer user questions accurately and professionally about SiteGist features, pricing, refund policy, and general platform usage.
  
  SYSTEM INSTRUCTIONS:
  ${systemPrompt || "Provide helpful, accurate answers based on the knowledge provided."}`
    : `SYSTEM INSTRUCTIONS / PERSONALITY:
  ${systemPrompt || "Provide helpful, accurate answers based on the knowledge context provided."}`;

  const fallbackMessage = isDemo
    ? "I am specialized only in SiteGist platform support. I can help you with pricing, features, crawling, or policies. For other topics, please contact our human support team."
    : "I don't have information about that. Please contact our support team for more help.";

  const prompt = `${identity}
  
  KNOWLEDGE CONTEXT:
  ${context}
  
  CONVERSATION HISTORY:
  ${promptHistory}

  STRICT FORMATTING RULES:
  1. BASE YOUR ANSWER ONLY ON THE "KNOWLEDGE CONTEXT" ABOVE.
  2. IF THE CONTEXT DOES NOT CONTAIN THE ANSWER, say: "${fallbackMessage}" (or use a custom politely phrased "I don't know" or fallback response if specified/requested in your SYSTEM INSTRUCTIONS).
  3. DO NOT HALLUCINATE.
  4. Use professional, concise PLAIN TEXT. 
  5. DO NOT use markdown symbols. NO stars (*), NO bolding (**), NO highlights.
  6. Use clean paragraphs or simple dashes (-) for lists.
  7. IF THE USER SAYS "hi" OR GREETS YOU, REPLY EXACTLY WITH: "Hi! How can I help you today?"
  
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

    yield `[ERROR] ${errorMsg}`;
    return;
  }

  // --- Answer Verification Layer ---
  console.log(`[Verification] Checking answer against context...`);
  const verificationPrompt = `Verify if the following answer is strictly supported by the provided context.
  
  CONTEXT:
  ${context}
  
  ANSWER:
  ${fullAnswer}
  
  Rules:
  - If the answer contains information NOT in the context, mark it as "UNVERIFIED".
  - If the answer is purely based on context, mark it as "VERIFIED".
  - Provide a short explanation.
  
  Output Format: JSON { "status": "VERIFIED" | "UNVERIFIED", "explanation": "..." }`;

  try {
    let verificationResult: any = { status: "VERIFIED", explanation: "Verified during generation." };
    
    if (gemini) {
      const vResp = await gemini.models.generateContent({
        model: "gemini-2.0-flash",
        contents: verificationPrompt,
        config: {
          maxOutputTokens: GEMINI_VERIFY_MAX_TOKENS
        }
      });
      const vText = vResp.text || "";
      // Simple JSON extraction
      const jsonMatch = vText.match(/\{.*\}/s);
      if (jsonMatch) verificationResult = JSON.parse(jsonMatch[0]);
    }

    if (verificationResult.status === "UNVERIFIED") {
       console.warn(`[Verification Alert] Answer was marked as UNVERIFIED: ${verificationResult.explanation}`);
       yield "\n\n⚠ This answer may need verification.";
    }
  } catch (vError) {
    console.error("[Verification] Error during verification step:", vError);
  }
  // ---------------------------------
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


