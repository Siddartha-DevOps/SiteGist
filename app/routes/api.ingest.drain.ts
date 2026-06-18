import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireUserId, getUser } from "~/backend/auth.server";
import { prisma } from "~/database/db.server";
import { drainQueuedSources } from "~/ai-layer/ingestion.server";

/**
 * Processes a small batch of "queued" KnowledgeSources for a project. The Train
 * page calls this on a loop while sources are in-flight, so a large sitemap crawl
 * drains a few pages at a time without ever blocking/timing-out a single request.
 * Each call claims its sources atomically, so overlapping calls are safe.
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const userId = await requireUserId(request);
  const user = await getUser(request);

  let projectId = "";
  try {
    const body = await request.json();
    projectId = String(body?.projectId || "");
  } catch {
    return json({ error: "Invalid body" }, { status: 400 });
  }
  if (!projectId) return json({ error: "Missing projectId" }, { status: 400 });

  // Authorize: the project must belong to the user (or they're a member).
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [{ userId }, { members: { some: { email: user?.email || "" } } }],
    },
    select: { id: true },
  });
  if (!project) return json({ error: "Not found" }, { status: 404 });

  try {
    const result = await drainQueuedSources(projectId);
    return json(result);
  } catch (err: any) {
    console.error("[Ingest Drain] failed:", err?.message);
    return json({ error: "Drain failed" }, { status: 500 });
  }
}
