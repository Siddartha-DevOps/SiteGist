import { Pinecone } from "@pinecone-database/pinecone";
import { env, EMBEDDING_PROVIDER, EMBEDDING_DIMENSION } from "~/env.server";

/**
 * Shared Pinecone client instance, lazily initialized.
 */
let _pinecone: Pinecone | null = null;

const getPineconeClient = () => {
  if (!_pinecone) {
    const apiKey = (env.PINECONE_API_KEY || "").trim();
    
    if (!apiKey) {
      console.warn("[Pinecone Audit] WARNING: PINECONE_API_KEY is not defined in environment variables.");
    } else {
      console.log(`[Pinecone Audit] Using Key Masked: ${apiKey.substring(0, 4)}...${apiKey.slice(-4)}`);
    }

    _pinecone = new Pinecone({
      apiKey: apiKey || "placeholder-empty-key",
    });
  }
  return _pinecone;
};

const getIndex = () => {
  const indexName = env.PINECONE_INDEX || "quickstart";
  return getPineconeClient().index(indexName);
};

// Create a Proxy for pineconeIndex so that it is initialized lazily at use time rather than import time.
export const pineconeIndex = new Proxy({} as any, {
  get(target, prop, receiver) {
    const index = getIndex();
    return Reflect.get(index, prop, receiver);
  },
});

export const pinecone = new Proxy({} as any, {
  get(target, prop, receiver) {
    const client = getPineconeClient();
    return Reflect.get(client, prop, receiver);
  },
});

// Run connection diagnostic check asynchronously ONLY if keys are provided, to prevent boot crashes or slow starts
setTimeout(async () => {
  const initApiKey = (env.PINECONE_API_KEY || "").trim();
  const indexName = env.PINECONE_INDEX || "quickstart";

  if (initApiKey) {
    try {
      const stats = await pineconeIndex.describeIndexStats();
      console.log(`[Pinecone Audit] SUCCESS: Connected to index "${indexName}". Stats:`, JSON.stringify(stats));
      
      const actualDimension = stats.dimension;
      if (actualDimension !== undefined && actualDimension !== EMBEDDING_DIMENSION) {
        console.error(`
================================================================================
🚨 CRITICAL PINECONE CONFIGURATION ERROR!
The Pinecone index "${indexName}" has dimension ${actualDimension}.
But the application is configured to use EMBEDDING_PROVIDER="${EMBEDDING_PROVIDER}" (expected dimension: ${EMBEDDING_DIMENSION}).
This will result in data corruption, query mismatch, or indexing failures!
Please create a Pinecone index with ${EMBEDDING_DIMENSION} dimensions, or update your EMBEDDING_PROVIDER!
================================================================================
`);
      } else {
        console.log(`[Pinecone Audit] Dimension check PASSED. Index dimension is ${actualDimension || "unknown"}, expected is ${EMBEDDING_DIMENSION}.`);
      }
    } catch (err) {
      console.error(`[Pinecone Audit] ERROR: Failed to connect to index "${indexName}".`, err);
    }
  }
}, 1000);

