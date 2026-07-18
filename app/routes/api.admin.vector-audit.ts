import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "~/database/db.server";
import { pineconeIndex } from "~/lib/pinecone.server";
import { EMBEDDING_DIMENSION } from "~/env.server";

/**
 * READ-ONLY per-source vector audit.
 *
 * Cross-checks each KnowledgeSource's status against the ACTUAL number of vectors
 * stored for it in Pinecone, so you can confirm that anything marked "indexed"
 * really has vectors (not just a self-reported chunksIndexed counter).
 *
 * This endpoint ONLY reads:
 *   - prisma.knowledgeSource.findMany (read)
 *   - pineconeIndex.namespace(projectId).query (read)
 * It never writes, updates, deletes, or re-indexes anything.
 *
 * Auth: CRON_SECRET, same as the cron routes.
 *   GET /api/admin/vector-audit?token=YOUR_CRON_SECRET
 *   GET /api/admin/vector-audit   (header: x-cron-secret: YOUR_CRON_SECRET)
 *
 * Optional query params:
 *   status=indexed     only audit sources with this status (recommended + faster)
 *   projectId=<id>     restrict to one project
 *   limit=<n>          max sources to audit (default 250)
 *   topK=<n>           per-source vector cap for counting (default 1000)
 */

// Per-source counting is done with a filtered Pinecone query (Pinecone has no
// count-by-metadata API). Vectors are namespaced per project; we filter on the
// same source/url metadata that deleteSourceChunks uses, so it's apples-to-apples.
function countUnitVector(): number[] {
  const v = new Array(EMBEDDING_DIMENSION).fill(0);
  v[0] = 1; // avoid an all-zero probe vector (undefined cosine)
  return v;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || request.headers.get("x-cron-secret");

  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const statusFilter = url.searchParams.get("status") || undefined;
  const projectIdFilter = url.searchParams.get("projectId") || undefined;
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "250", 10) || 250, 2000);
  const topK = Math.min(parseInt(url.searchParams.get("topK") || "1000", 10) || 1000, 10000);

  const where: Record<string, any> = {};
  if (statusFilter) where.status = statusFilter;
  if (projectIdFilter) where.projectId = projectIdFilter;

  const totalMatching = await prisma.knowledgeSource.count({ where });

  const sources = await prisma.knowledgeSource.findMany({
    where,
    orderBy: [{ projectId: "asc" }, { createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      projectId: true,
      type: true,
      source: true,
      title: true,
      status: true,
      chunksIndexed: true,
      chunksTotal: true,
      lastIndexedAt: true,
    },
  });

  const probe = countUnitVector();

  // Count actual Pinecone vectors for one source via a filtered query.
  async function countVectors(s: (typeof sources)[number]): Promise<{ count: number; capped: boolean; error?: string }> {
    // Mirror deleteSourceChunks' key: web uses the URL; others use title || source.
    const sourceValue = s.type === "web" ? s.source : s.title || s.source;
    try {
      const res: any = await pineconeIndex.namespace(s.projectId).query({
        topK,
        vector: probe,
        includeMetadata: false,
        includeValues: false,
        filter: {
          $or: [{ source: { $eq: sourceValue } }, { url: { $eq: sourceValue } }],
        },
      });
      const count = (res?.matches || []).length;
      return { count, capped: count >= topK };
    } catch (e: any) {
      return { count: -1, capped: false, error: e?.message ? String(e.message).slice(0, 300) : "query failed" };
    }
  }

  // Bounded concurrency so we don't hammer Pinecone or blow the function timeout.
  const CONCURRENCY = 5;
  const results: any[] = [];
  for (let i = 0; i < sources.length; i += CONCURRENCY) {
    const batch = sources.slice(i, i + CONCURRENCY);
    const counted = await Promise.all(batch.map(async (s) => ({ s, r: await countVectors(s) })));
    for (const { s, r } of counted) {
      const pineconeVectors = r.count;
      let flag = "ok";
      if (r.error) flag = "AUDIT_ERROR";
      else if (s.status === "indexed" && pineconeVectors === 0) flag = "INDEXED_BUT_EMPTY";
      else if (s.status === "indexed" && s.chunksTotal > 0 && pineconeVectors > 0 && pineconeVectors < s.chunksTotal)
        flag = "PARTIAL";
      else if (s.status !== "indexed") flag = s.status;

      results.push({
        id: s.id,
        projectId: s.projectId,
        type: s.type,
        status: s.status,
        chunksIndexedDb: s.chunksIndexed,
        chunksTotalDb: s.chunksTotal,
        pineconeVectors,
        capped: r.capped,
        lastIndexedAt: s.lastIndexedAt,
        name: (s.title || s.source || "").slice(0, 100),
        flag,
        ...(r.error ? { auditError: r.error } : {}),
      });
    }
  }

  const indexedButEmpty = results.filter((r) => r.flag === "INDEXED_BUT_EMPTY");
  const partial = results.filter((r) => r.flag === "PARTIAL");
  const auditErrors = results.filter((r) => r.flag === "AUDIT_ERROR");

  return json({
    ok: true,
    index: process.env.PINECONE_INDEX || "quickstart",
    embeddingDimension: EMBEDDING_DIMENSION,
    filters: { status: statusFilter || null, projectId: projectIdFilter || null, limit, topK },
    totalMatchingSources: totalMatching,
    audited: results.length,
    summary: {
      indexedButEmpty: indexedButEmpty.length,
      partial: partial.length,
      auditErrors: auditErrors.length,
    },
    // The rows that violate the guarantee (indexed, but zero real vectors) up front.
    indexedButEmpty,
    sources: results,
  });
}
