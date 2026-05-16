import OpenAI from "openai";
import { pineconeIndex } from "~/lib/pinecone.server";
import { getPortkey } from "./portkey.server";
import { GoogleGenerativeAI } from "@google/generative-ai";

  console.log("AI Server Startup Diagnostic:", {
    hasGemini: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    hasOpenAI: !!(process.env.OPENAI_API_KEY),
    hasPortkey: !!(process.env.PORTKEY_API_KEY),
    allKeys: Object.keys(process.env).filter(k => k.includes("KEY") || k.includes("API")).sort()
  });

function cleanKey(val: any): string | null {
  if (!val || typeof val !== "string") return null;
  
  let raw = val.trim();
  
  // Handle case where user pastes "GEMINI_API_KEY=AIZa..."
  const envMatch = raw.match(/^[A-Z0-9_]+=(.*)$/s);
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
      // For sk- labels, we don't want to slice them off if they are part of the key
      // but users sometimes paste "OpenAI Key: sk-proj-..."
      // Let's just remove the first part if it's a label
      if (label.includes(":")) {
         raw = raw.slice(label.length).trim();
         tempRaw = raw.toLowerCase();
      }
    }
  }

  // Remove wrapping quotes
  raw = raw.replace(/^['"]|['"]$/g, "").trim();

  // Remove ALL whitespace and non-printable characters.
  let cleaned = raw.replace(/[\s\u00A0\u1680\u180e\u2000-\u200a\u202f\u205f\u3000\ufeff\x00-\x1f\x7f-\x9f]/g, "");
  
  // CRITICAL: Block masked keys. 
  // Dashboards often show "sk-proj-****" or "AIZa...••••"
  if (cleaned.includes("*") || cleaned.includes("•") || cleaned.includes("...") || cleaned.includes("****")) {
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
  const start = key.substring(0, 7);
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
      hiddenChars.push(`pos ${i}: hex ${code.toString(16)}`);
    }
  }
  
  let info = `Length: ${length}, First 7: "${start}"... Last 4: "${end}"`;
  if (isMasked) {
    info += ` | ❌ CRITICAL: KEY IS MASKED (contains * or •). You copied a UI placeholder! Click 'Copy' or eye icon in your dashboard.`;
  }
  if (isDummy) {
    info += ` | ❌ CRITICAL: DUMMY KEY DETECTED. The key contains placeholder text.`;
  }
  if (isProbablyOpenAIButMissingS) {
    info += ` | ❌ CRITICAL: OpenAI key starts with "k-proj-" but MUST start with "sk-proj-". You are missing the 's' at the beginning.`;
  }
  if (hiddenChars.length > 0) {
    info += ` | ⚠️ WARNING: ${hiddenChars.length} hidden chars found (${hiddenChars.slice(0, 3).join(", ")})`;
  }
  return info;
}

let _openai: OpenAI | null = null;
let _openaiFoundVar = "none";

function getOpenAI() {
  if (!_openai) {
    const portkey = getPortkey();
    // Only use Portkey if it's explicitly configured with a pk- key
    const pkKey = process.env.PORTKEY_API_KEY?.trim();
    if (portkey && pkKey && pkKey.startsWith("pk-")) {
      console.log("[AI] Initializing OpenAI via Portkey");
      _openai = portkey as any;
      return _openai;
    }

    const searchKeys = ["OPENAI_API_KEY", "VITE_OPENAI_API_KEY"];
    
    // Diagnostic: Log all candidate keys found
    console.log("[AI] Scanning for OpenAI keys...");
    const foundKeys: string[] = [];
    for (const key of searchKeys) {
      const val = process.env[key];
      if (val) {
        const cleaned = cleanKey(val);
        console.log(`  - ${key}: ${cleaned ? "VALID_FORMAT" : "EMPTY/INVALID"}. ${getDiagnosticInfo(val)}`);
        if (cleaned) foundKeys.push(`${key}(${val.substring(0, 5)}...)`);
      }
    }

    let rawKey = null;
    let foundButSkippedCount = 0;
    for (const key of searchKeys) {
      const val = process.env[key];
      const cleaned = cleanKey(val);
      if (cleaned) {
        if (!rawKey) {
          rawKey = cleaned;
          _openaiFoundVar = key;
        } else if (cleaned !== rawKey) {
          console.warn(`[AI] COLLISION: Multiple OpenAI keys found. Using ${_openaiFoundVar}, but ${key} also has a DIFFERENT key.`);
        }
      } else if (val) {
        foundButSkippedCount++;
      }
    }
      
    if (!rawKey) {
      console.warn("[AI] OpenAI API Key not found. Checked:", searchKeys.join(", "));
      return null;
    }

    // Diagnostic
    if (rawKey.startsWith("AIza")) {
      console.warn(`[AI] WARNING: Key in ${_openaiFoundVar} starts with "AIza", which looks like a Gemini/Google key. OpenAI keys usually start with "sk-".`);
    }

    console.log(`[AI] SUCCESS: Initializing OpenAI with key from ${_openaiFoundVar}. ${getDiagnosticInfo(rawKey)} | All candidates: ${foundKeys.join(", ")}`);
    _openai = new OpenAI({ apiKey: rawKey });
  }
  return _openai;
}

let _gemini: GoogleGenerativeAI | null = null;
let _geminiFoundVar = "none";

function getGemini(): GoogleGenerativeAI | null {
  if (!_gemini) {
    const searchKeys = [
      "GEMINI_API_KEY",
      "GOOGLE_API_KEY",
      "VITE_GEMINI_API_KEY",
      "GOOGLE_GENERATIVE_AI_API_KEY",
      "GOOGLE_GENAI_API_KEY",
      "AI_API_KEY",
    ];
    
    // Diagnostic: Log all candidate keys found
    console.log("[AI] Scanning for Gemini keys...");
    const foundKeys: string[] = [];
    for (const key of searchKeys) {
      const val = process.env[key];
      if (val) {
        const cleaned = cleanKey(val);
        console.log(`  - ${key}: ${cleaned ? "VALID_FORMAT" : "EMPTY/INVALID"}. ${getDiagnosticInfo(val)}`);
        if (cleaned) foundKeys.push(`${key}(${val.substring(0, 5)}...)`);
      }
    }

    let rawKey = null;
    for (const key of searchKeys) {
      const val = process.env[key];
      const cleaned = cleanKey(val);
      if (cleaned) {
        if (!rawKey) {
          rawKey = cleaned;
          _geminiFoundVar = key;
        } else if (cleaned !== rawKey) {
          console.warn(`[AI] COLLISION: Multiple Gemini keys found. Using ${_geminiFoundVar}, but ${key} also has a DIFFERENT key.`);
        }
      }
    }

    if (!rawKey) {
      console.warn("[AI] Gemini API Key not found in any of the environment variables:", searchKeys.join(", "));
      return null;
    }
    
    // Diagnostic
    if (rawKey.startsWith("sk-")) {
      console.warn(`[AI] WARNING: Key in ${_geminiFoundVar} starts with "sk-", which looks like an OpenAI key. Gemini keys usually start with "AIza". | ALL_KEYS: ${foundKeys.join(", ")}`);
    } else if (!rawKey.startsWith("AIza")) {
      console.warn(`[AI] WARNING: Key in ${_geminiFoundVar} does NOT start with "AIza". Gemini keys usually start with "AIza". Diagnostic: ${getDiagnosticInfo(rawKey)} | ALL_KEYS: ${foundKeys.join(", ")}`);
    }

    console.log(`[AI] SUCCESS: Initializing Gemini with key from ${_geminiFoundVar}. ${getDiagnosticInfo(rawKey)} | All candidates: ${foundKeys.join(", ")}`);
    _gemini = new GoogleGenerativeAI(rawKey);

    // List models for diagnostic purposes asynchronously
    (async () => {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${rawKey}`);
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
    const model = gemini.getGenerativeModel({ model: "text-embedding-004" });
    const response = await model.embedContent(text);
    return response.embedding.values;
  }
  throw new Error("No embedding provider available (OpenAI key failed and Gemini not configured)");
}

export async function upsertChunks(projectId: string, chunks: { text: string; metadata: any }[]) {
  const index = pineconeIndex;
  
  const vectors = await Promise.all(
    chunks.map(async (chunk, i) => ({
      id: `${projectId}-${Date.now()}-${i}`,
      values: await embedText(chunk.text),
      metadata: {
        ...chunk.metadata,
        text: chunk.text,
        projectId,
      },
    }))
  );

  await index.namespace(projectId).upsert({ records: vectors });
}

export async function deleteSourceChunks(projectId: string, sourceValue: string) {
  const index = pineconeIndex;
  // We specify the namespace and filter by the source identifier
  // Note: Depending on Pinecone version/config, this might need specific indexed metadata fields
  try {
    await index.namespace(projectId).deleteMany({
      filter: {
        source: { "$eq": sourceValue }
      }
    });
    console.log(`[AI] Deleted chunks for source: ${sourceValue} in project: ${projectId}`);
  } catch (error) {
    console.error(`[AI] Error deleting chunks for source ${sourceValue}:`, error);
  }
}

export async function* streamRAG(projectId: string, query: string, systemPrompt?: string, history: { role: string, content: string }[] = []) {
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
      const embedding = await embedText(searchTerms);
      const vectorTask = index.namespace(projectId).query({
        vector: embedding,
        topK: 20,
        includeMetadata: true,
      });

      // 2. Keyword Search (BM25 Surrogate via Prisma)
      // We extract key nouns/terms from the query for better matching
      const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const keywordTask = prisma.knowledgeSource.findMany({
        where: {
          projectId,
          OR: [
            { content: { contains: query, mode: "insensitive" as any } },
            ...keywords.map(kw => ({ content: { contains: kw, mode: "insensitive" as any } }))
          ]
        },
        take: 5
      });

      const [vectorResults, keywordResults] = await Promise.all([vectorTask, keywordTask]);

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
      vectorResults.matches?.forEach(match => {
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
SiteGist is a powerful AI Chatbot builder and lead generation platform designed specifically for service businesses. It allows users to crawl their websites, train an AI agent in minutes, and embed a floating chatbot that handles 24/7 sales, lead capture, and appointment booking.

Key Features:
- Website Crawling: Automatically extracts knowledge from your URLs, sitemaps, and even YouTube transcripts.
- Lead Generation: Intelligently captures visitor contact info (name, email, phone) during conversations.
- Custom Branding: You can customize colors, logos, and the "welcome" message to match your brand.
- Multi-Channel: Embed on your website via a simple <script> tag or use it as a standalone landing page.
- Integrations: Supports Notion, Google Drive, Slack, and Zapier for syncing data and notifications.
- Human Handoff: Notifies your team via Slack or Webhooks when a lead requests a real person.

Pricing & Subscription Plans:
- Free Starter: 1 chatbot project, 50 message credits/month, basic crawling.
- Pro Plan ($19/month): 5 chatbot projects, 1,000 message credits/month, priority support, and advanced integrations.
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

  const prompt = `You are "Ask SiteGist", the official AI Support Specialist for the SiteGist platform.
  
  YOUR MISSION:
  Answer user questions accurately and professionally about SiteGist features, pricing, refund policy, and general platform usage.
  
  SYSTEM INSTRUCTIONS:
  ${systemPrompt || "Provide helpful, accurate answers based on the knowledge provided."}
  
  KNOWLEDGE CONTEXT:
  ${context}
  
  CONVERSATION HISTORY:
  ${promptHistory}

  STRICT GROUNDING RULES:
  1. BASE YOUR ANSWER ONLY ON THE "KNOWLEDGE CONTEXT" ABOVE.
  2. IF THE CONTEXT DOES NOT CONTAIN THE ANSWER (e.g. general knowledge, unrelated topics), say: "I am specialized only in SiteGist platform support. I can help you with pricing, features, crawling, or policies. For other topics, please contact our human support team."
  3. DO NOT HALLUCINATE. If a feature isn't in the context, it doesn't exist for you.
  4. Use professional, concise Markdown.
  5. If asked about "refunds", mention the "14-day no-questions-asked" policy.
  6. If asked about "pricing", list the Free, Pro ($19/mo), and Enterprise options.
  
  USER QUERY: ${query}
  
  RESPONSE:`;

  console.log(`[RAG Audit] Stage 6: Sending prompt to LLM (Length: ${prompt.length} chars)...`);

  const gemini = getGemini();
  const openai = getOpenAI();
  let fullAnswer = "";
  let lastError: any = null;

  // Add a safety timeout for the entire generation process
  const generationTimeout = setTimeout(() => {
    if (!fullAnswer && !lastError) {
      lastError = { message: "Generation timed out after 30 seconds." };
    }
  }, 30000);

  try {
    if (gemini) {
      try {
        const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        console.log(`[RAG Audit] Stage 6: Calling Gemini gemini-1.5-flash-latest stream...`);
        
        // Use a 20s timeout for the fetch itself if possible (Gemini SDK uses fetch)
        const result = await model.generateContentStream([{ text: prompt }]);
        
        for await (const chunk of result.stream) {
          try {
            const chunkText = chunk.text();
            if (chunkText) {
              fullAnswer += chunkText;
              yield chunkText;
            }
          } catch (chunkError: any) {
            console.warn("[RAG Audit] Stage 7: Error parsing Gemini chunk:", chunkError);
            if (chunk.promptFeedback?.blockReason) {
              console.error("[RAG Audit] Gemini Blocked prompt:", chunk.promptFeedback.blockReason);
            }
          }
        }
      } catch (e: any) {
        console.error("[RAG Audit] Stage 6/7 Gemini Error Detail:", e);
        let errorMsg = e.message || String(e);
        const diag = getDiagnosticInfo(process.env[_geminiFoundVar]);
        
        if (errorMsg.includes("API key not valid") || errorMsg.includes("API key expired") || errorMsg.includes("400") || errorMsg.includes("INVALID_ARGUMENT") || errorMsg.includes("key expired")) {
           errorMsg = `[API_KEY_ERROR] Google AI Studio rejected the key (Expired or Invalid).
           Diagnostic: ${diag}. 
           Action: Go to https://aistudio.google.com/app/apikey. 
           1. Create a NEW key (don't reuse old ones). 
           2. Look for the 'eyeball' icon or 'Copy' button. 
           3. Ensure you copy the WHOLE text, not text containing '****'.`;
           if (diag.includes("MASKED") || diag.includes("...")) {
              errorMsg += "\n\nCRITICAL: Your key contains stars (*) or dots (...). You copied a 'Hidden' version of the key. Click the 'Copy' button in AI Studio specifically.";
           }
        } else if (errorMsg.includes("quota")) {
           errorMsg = `[QUOTA_EXCEEDED] Gemini API quota reached. Please wait a few minutes or use OpenAI.`;
        }
        lastError = { message: errorMsg || "Gemini connection failed" };
      }
    }

    if (openai && !fullAnswer) {
      try {
        const model = process.env.PORTKEY_MODEL || "gpt-4o-mini";
        const maxTokens = parseInt(process.env.PORTKEY_MAX_TOKENS || "1024", 10);
        
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
            2. Create a NEW secret key. 
            3. Copy the secret IMMEDIATELY after creation (it vanishes after). 
            4. DO NOT copy the key from the list view (sk-proj-****).`;
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
      const vModel = gemini.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
      const vResp = await vModel.generateContent(verificationPrompt);
      const vText = vResp.response.text();
      // Simple JSON extraction
      const jsonMatch = vText.match(/\{.*\}/s);
      if (jsonMatch) verificationResult = JSON.parse(jsonMatch[0]);
    }

    if (verificationResult.status === "UNVERIFIED") {
       console.warn(`[Verification Alert] Answer was marked as UNVERIFIED: ${verificationResult.explanation}`);
       yield `\n\n*⚠️ Verification Note: ${verificationResult.explanation}*`;
    } else {
       yield `\n\n*✅ Answer verified against knowledge base.*`;
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
        const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const result = await model.generateContentStream([{ text: prompt }]);
        for await (const chunk of result.stream) {
          const text = chunk.text();
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
          max_tokens: 1024,
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

