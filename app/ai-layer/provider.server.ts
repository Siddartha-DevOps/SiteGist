import { AI_PROVIDER, EMBEDDING_DIMENSION, EMBEDDING_PROVIDER, env } from "~/env.server";

/**
 * Central AI provider registry — the single source of truth for which stack the
 * app talks to. Import `AI` from here to resolve base URLs, embedding dimension,
 * and the rerank endpoint, so moving between the hosted "cloud" providers and a
 * self-hosted "local" stack (Ollama/vLLM + bge-m3 + a local reranker) is a
 * config change (AI_PROVIDER + the LOCAL_* / EMBEDDING_DIMENSION envs), not a
 * code edit.
 *
 * All values here derive from the validated env module (env.server.ts) — this
 * file performs no direct process.env reads.
 */
export interface ProviderConfig {
  provider: "cloud" | "local";
  /** OpenAI-compatible chat base URL. `undefined` on cloud → the SDK default. */
  llmBaseUrl?: string;
  /** OpenAI-compatible embeddings base URL. `undefined` on cloud → SDK default. */
  embedBaseUrl?: string;
  /** Embedding vector length — must match the Pinecone index dimension. */
  embeddingDimension: number;
  /** Whether reranking is enabled (governed by RERANK_ENABLED). */
  rerankEnabled: boolean;
  /** Rerank endpoint — Cohere-via-Portkey by default, or a self-hosted reranker. */
  rerankUrl: string;
  /** Which embedding family the cloud stack uses (openai | gemini). */
  embeddingProvider: "openai" | "gemini";
}

const CLOUD: ProviderConfig = {
  provider: "cloud",
  llmBaseUrl: undefined,   // OpenAI / Gemini SDKs use their hosted defaults
  embedBaseUrl: undefined,
  embeddingDimension: EMBEDDING_DIMENSION,
  rerankEnabled: env.RERANK_ENABLED,
  rerankUrl: env.RERANK_URL || "https://api.portkey.ai/v1/rerank",
  embeddingProvider: EMBEDDING_PROVIDER,
};

const LOCAL: ProviderConfig = {
  provider: "local",
  llmBaseUrl: env.LOCAL_LLM_URL || "http://localhost:11434/v1",
  embedBaseUrl: env.LOCAL_EMBED_URL || "http://localhost:11434/v1",
  embeddingDimension: EMBEDDING_DIMENSION, // default 1024 (bge-m3) via env.server
  rerankEnabled: env.RERANK_ENABLED,
  rerankUrl: env.RERANK_URL || "",
  embeddingProvider: EMBEDDING_PROVIDER,
};

/** The active provider configuration, selected by AI_PROVIDER. */
export const AI: ProviderConfig = AI_PROVIDER === "local" ? LOCAL : CLOUD;
