import { Pinecone } from "@pinecone-database/pinecone";

/**
 * Shared Pinecone client instance.
 * Initialized with the API key from environment variables.
 */
const getPineconeClient = () => {
  const apiKey = (process.env.PINECONE_API_KEY || process.env.Pinecone_API_KEY)?.trim();
  
  if (!apiKey) {
    console.warn("PINECONE_API_KEY is not defined in environment variables.");
  } else {
    // Diagnostic (masked)
    console.log(`[Pinecone Audit] Using Key Masked: ${apiKey.substring(0, 4)}...${apiKey.slice(-4)}`);
  }

  return new Pinecone({
    apiKey: apiKey || "",
  });
};

const indexName = process.env.PINECONE_INDEX || "quickstart";

console.log(`[Pinecone Audit] Initializing Pinecone client with index: ${indexName}`);

export const pinecone = getPineconeClient();

/**
 * Reference to the Pinecone index.
 */
export const pineconeIndex = pinecone.index(indexName);

// Test the index connection asynchronously
(async () => {
  try {
    const stats = await pineconeIndex.describeIndexStats();
    console.log(`[Pinecone Audit] SUCCESS: Connected to index "${indexName}". Stats:`, JSON.stringify(stats));
  } catch (err) {
    console.error(`[Pinecone Audit] ERROR: Failed to connect to index "${indexName}". Check PINECONE_API_KEY and index existence.`, err);
  }
})();
