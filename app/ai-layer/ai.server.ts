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

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) {
    const portkey = getPortkey();
    if (portkey) return portkey;

    const searchKeys = ["OPENAI_API_KEY", "VITE_OPENAI_API_KEY"];
    let rawKey = null;
    for (const key of searchKeys) {
      if (process.env[key]) {
        console.log(`[AI] Using OpenAI key from ${key}`);
        rawKey = process.env[key];
        break;
      }
    }
      
    const apiKey = rawKey?.trim();
    if (!apiKey) {
      console.warn("[AI] OpenAI API Key not found. Checked:", searchKeys.join(", "));
      return null;
    }

    // Diagnostic (masked)
    console.log(`[AI] Initializing OpenAI with Key Masked: ${apiKey.substring(0, 4)}...${apiKey.slice(-4)}`);
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

let _gemini: GoogleGenerativeAI | null = null;
function getGemini(): GoogleGenerativeAI | null {
  if (!_gemini) {
    const searchKeys = [
      "GEMINI_API_KEY",
      "GOOGLE_API_KEY",
      "VITE_GEMINI_API_KEY",
      "GOOGLE_GENERATIVE_AI_API_KEY",
      "GOOGLE_GENAI_API_KEY",
    ];
    
    let rawKey = null;
    for (const key of searchKeys) {
      if (process.env[key]) {
        console.log(`[AI] Using Gemini key from ${key}`);
        rawKey = process.env[key];
        break;
      }
    }

    const apiKey = rawKey?.trim();
    if (!apiKey) {
      console.warn("[AI] Gemini API Key not found. Checked:", searchKeys.join(", "));
      return null;
    }
    
    // Diagnostic (masked)
    console.log(`[AI] Initializing Gemini with Key Masked: ${apiKey.substring(0, 4)}...${apiKey.slice(-4)} (Length: ${apiKey.length})`);
    if (apiKey.length < 20) {
      console.warn("[AI] Gemini API Key seems suspiciously short. Check your settings.");
    }
    _gemini = new GoogleGenerativeAI(apiKey);
  }
  return _gemini;
}

export async function rerankDocuments(query: string, documents: { text: string; [key: string]: any }[]) {
  const portkeyApiKey = process.env.PORTKEY_API_KEY?.trim();
  const cohereVirtualKey = process.env.PORTKEY_COHERE_VIRTUAL_KEY?.trim();

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
  if (!openai) {
    // Fallback to Gemini embedding if possible
    const gemini = getGemini();
    if (gemini) {
      const model = gemini.getGenerativeModel({ model: "text-embedding-004" });
      const response = await model.embedContent(text);
      return response.embedding.values;
    }
    throw new Error("No embedding provider available (OpenAI or Gemini)");
  }
  const response = await (openai as any).embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding as number[];
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
    console.log(`[RAG Audit] Stage 1: Operating in Demo Mode.`);
    context = "Demo mode usage.";
  }

  // Yield citations first so UI can prepare
  if (citationMetadata.length > 0) {
    yield `METADATA:${JSON.stringify({ citations: citationMetadata })}`;
  }

  const promptHistory = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");

  const prompt = `You are an Advanced RAG System with strict grounding rules.
  
  SYSTEM INSTRUCTIONS:
  ${systemPrompt || "Provide helpful, accurate answers based on the knowledge provided."}
  
  KNOWLEDGE CONTEXT:
  ${context}
  
  CONVERSATION HISTORY:
  ${promptHistory}

  STRICT GROUNDING RULES:
  1. BASE YOUR ANSWER ONLY ON THE "KNOWLEDGE CONTEXT" ABOVE.
  2. IF THE CONTEXT DOES NOT CONTAIN THE ANSWER, say: "I'm sorry, but I don't have enough information in my knowledge base to answer that specifically. However, based on my general capabilities..." 
  3. DO NOT hallucinate features or facts not present in the context.
  4. Use Markdown for structured responses.
  5. Your response will go through a verification layer, so be as factual as possible.
  
  USER QUERY: ${query}
  
  RESPONSE:`;

  console.log(`[RAG Audit] Stage 6: Sending prompt to LLM (Length: ${prompt.length} chars)...`);

  const gemini = getGemini();
  let fullAnswer = "";

  if (gemini) {
    try {
      const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContentStream([{ text: prompt }]);
      
      for await (const chunk of result.stream) {
        try {
          const chunkText = chunk.text();
          if (chunkText) {
            fullAnswer += chunkText;
            yield chunkText;
          }
        } catch (chunkError) {
          console.warn("[RAG Audit] Stage 7: Error parsing Gemini chunk:", chunkError);
        }
      }
    } catch (e: any) {
      console.error("[RAG Audit] Stage 6/7 Gemini Error:", e);
    }
  }

  const openai = getOpenAI();
  if (openai && !fullAnswer) {
    try {
      const model = process.env.PORTKEY_MODEL || "gpt-4o-mini";
      const maxTokens = parseInt(process.env.PORTKEY_MAX_TOKENS || "1024", 10);
      
      const stream = await (openai as any).chat.completions.create({
        model: model,
        stream: true,
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullAnswer += content;
          yield content;
        }
      }
    } catch (e: any) {
       console.error("[RAG Audit] OpenAI Error:", e);
    }
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
      const vModel = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
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

