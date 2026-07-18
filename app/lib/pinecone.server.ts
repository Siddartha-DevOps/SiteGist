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
    } else if (process.env.NODE_ENV !== "production") {
      // Key-fragment diagnostics for local debugging only — never in production logs.
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

/**
 * Refuse to write vectors whose dimension doesn't match the configured embedding
 * dimension. Previously a dimension mismatch was only logged ("CRITICAL CONFIG
 * ERROR") while the write still went ahead, which corrupts the index (or fails
 * the query later). We now throw before the upsert reaches Pinecone.
 */
function assertUpsertDimensions(arg: any) {
  const records = Array.isArray(arg)
    ? arg
    : arg && Array.isArray(arg.records)
      ? arg.records
      : arg && Array.isArray(arg.vectors)
        ? arg.vectors
        : [];
  for (const r of records) {
    const dim = r?.values?.length;
    if (typeof dim === "number" && dim !== EMBEDDING_DIMENSION) {
      throw new Error(
        `[Pinecone] Refusing upsert: vector "${r?.id ?? "?"}" has dimension ${dim}, but the configured ` +
          `embedding dimension is ${EMBEDDING_DIMENSION}. Writing mismatched vectors would corrupt the index — aborting.`
      );
    }
  }
}

function wrapUpsert(upsertFn: Function, ctx: any) {
  return (arg: any) => {
    assertUpsertDimensions(arg);
    return upsertFn.call(ctx, arg);
  };
}

// Create a Proxy for pineconeIndex so that it is initialized lazily at use time rather than import time.
// The proxy also guards every upsert (both `index.upsert(...)` and
// `index.namespace(ns).upsert(...)`) against dimension mismatches.
export const pineconeIndex = new Proxy({} as any, {
  get(target, prop) {
    const index = getIndex();

    if (prop === "namespace") {
      return (ns: string) => {
        const nsIndex = index.namespace(ns);
        return new Proxy(nsIndex, {
          get(t: any, p) {
            const v = Reflect.get(t, p);
            if (p === "upsert" && typeof v === "function") return wrapUpsert(v, t);
            return typeof v === "function" ? v.bind(t) : v;
          },
        });
      };
    }

    if (prop === "upsert" && typeof (index as any).upsert === "function") {
      return wrapUpsert((index as any).upsert, index);
    }

    const val = Reflect.get(index, prop);
    return typeof val === "function" ? val.bind(index) : val;
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

