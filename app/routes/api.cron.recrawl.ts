import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "~/database/db.server";
import { enqueueSourceIngestion } from "~/ai-layer/ingestion.server";

// Daily auto-recrawl. Re-indexes every web/youtube KnowledgeSource whose
// nextRecrawlAt has passed, then schedules its next refresh.
//
// Hit daily from Vercel Crons (configured in vercel.json) or any external
// scheduler. Secured with CRON_SECRET, matching the other cron routes:
//   GET /api/cron/recrawl?token=YOUR_CRON_SECRET
//   GET /api/cron/recrawl   (header: x-cron-secret: YOUR_CRON_SECRET)

// Bounded per run so a single invocation can't time out; whatever isn't picked
// up stays due (nextRecrawlAt in the past) and is processed on the next run.
const RECRAWL_BATCH = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || request.headers.get("x-cron-secret");

  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Only sources with an interval set, already indexed, and due for a refresh.
  // Auto-recrawl applies to web/youtube sources (the only types with a live
  // origin to re-fetch).
  const due = await prisma.knowledgeSource.findMany({
    where: {
      recrawlIntervalDays: { not: null },
      nextRecrawlAt: { lte: now },
      status: "indexed",
      type: { in: ["web", "youtube"] },
    },
    orderBy: { nextRecrawlAt: "asc" },
    take: RECRAWL_BATCH,
    select: { id: true, projectId: true, recrawlIntervalDays: true },
  });

  let queued = 0;
  let failed = 0;

  for (const source of due) {
    const intervalDays = source.recrawlIntervalDays ?? 30;
    try {
      // Re-index even if content is unchanged so the schedule is honoured.
      await enqueueSourceIngestion(source.projectId, source.id, { force: true });
      await prisma.knowledgeSource.update({
        where: { id: source.id },
        data: { nextRecrawlAt: new Date(now.getTime() + intervalDays * DAY_MS) },
      });
      queued++;
    } catch (err) {
      // Don't let one bad source abort the batch; it stays due and retries next run.
      console.error(`[cron/recrawl] Failed to re-queue source ${source.id}:`, err);
      failed++;
    }
  }

  return json({ ok: true, due: due.length, queued, failed });
}
