/**
 * Ops metrics for the authenticated account — a lightweight dashboard data source.
 * Returns ingestion health (status breakdown, success rate, in-flight, recent
 * failures) scoped to the user's own projects, plus which observability/quality
 * features are currently active. GET /api/admin/metrics
 */
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireUserId } from "~/backend/auth.server";
import { prisma } from "~/database/db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);

  const projects = await prisma.project.findMany({ where: { userId }, select: { id: true } });
  const projectIds = projects.map((p) => p.id);

  const sources = projectIds.length
    ? await prisma.knowledgeSource.findMany({
        where: { projectId: { in: projectIds } },
        select: { status: true },
      })
    : [];

  const byStatus: Record<string, number> = {};
  for (const s of sources) byStatus[s.status] = (byStatus[s.status] || 0) + 1;
  const total = sources.length;
  const indexed = byStatus["indexed"] || 0;
  const failed = byStatus["failed"] || 0;
  const inFlight =
    (byStatus["queued"] || 0) +
    (byStatus["crawling"] || 0) +
    (byStatus["embedding"] || 0) +
    (byStatus["processing"] || 0);
  const successRate = total ? Number(((indexed / total) * 100).toFixed(1)) : null;

  const recentFailures = projectIds.length
    ? await prisma.knowledgeSource.findMany({
        where: { projectId: { in: projectIds }, status: "failed" },
        select: { id: true, projectId: true, source: true, title: true, error: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 10,
      })
    : [];

  return json({
    generatedAt: new Date().toISOString(),
    projects: projectIds.length,
    sources: { total, byStatus, successRate, indexed, failed, inFlight },
    recentFailures,
    config: {
      asyncIngestion: !!(process.env.INNGEST_EVENT_KEY || process.env.INNGEST_DEV),
      rerank: !!(process.env.PORTKEY_API_KEY && process.env.PORTKEY_COHERE_VIRTUAL_KEY),
      multiQuery: process.env.RAG_MULTI_QUERY === "1",
      sentry: !!process.env.SENTRY_DSN,
    },
  });
}
