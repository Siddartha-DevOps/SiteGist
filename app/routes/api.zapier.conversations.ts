import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "~/database/db.server";
import { requireApiKey } from "~/backend/api-auth.server";

// GET /api/zapier/conversations?projectId=xxx&event=conversation.resolved&limit=3
// Returns recent conversations shaped like escalated/resolved webhook payloads.
// Zapier uses this endpoint for sample data when setting up a Zap.
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireApiKey(request);
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  const eventFilter = url.searchParams.get("event");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "3", 10), 25);

  if (!projectId) {
    return json({ error: "projectId query param is required" }, { status: 400 });
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id },
    select: { id: true, name: true },
  });
  if (!project) return json({ error: "Project not found" }, { status: 404 });

  const where: Record<string, unknown> = { projectId };
  if (eventFilter === "conversation.resolved") {
    where.status = "resolved";
  } else if (eventFilter === "conversation.escalated") {
    where.mode = "human";
  }

  const sessions = await prisma.chatSession.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      status: true,
      mode: true,
      customerEmail: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const data = sessions.map(session => ({
    event: session.status === "resolved"
      ? "conversation.resolved"
      : "conversation.escalated",
    timestamp: session.updatedAt.toISOString(),
    project: { id: project.id, name: project.name },
    data: {
      session: {
        id: session.id,
        status: session.status,
        mode: session.mode,
        customerEmail: session.customerEmail,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    },
  }));

  return json(data);
}
