import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "~/database/db.server";
import { requireApiKey } from "~/backend/api-auth.server";

const VALID_EVENTS = [
  'all',
  'lead.captured',
  'conversation.escalated',
  'conversation.resolved',
  'message.received',
];

// GET /api/zapier/hooks?projectId=xxx — list active subscriptions
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireApiKey(request);
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");

  if (!projectId) {
    return json({ error: "projectId query param is required" }, { status: 400 });
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id },
    select: { id: true },
  });
  if (!project) return json({ error: "Project not found" }, { status: 404 });

  const hooks = await prisma.zapierHook.findMany({
    where: { projectId },
    select: { id: true, hookUrl: true, event: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return json({ hooks });
}

// POST /api/zapier/hooks — subscribe a new hook
// DELETE /api/zapier/hooks?hookId=xxx — unsubscribe
export async function action({ request }: ActionFunctionArgs) {
  const user = await requireApiKey(request);

  if (request.method === "POST") {
    const body = await request.json().catch(() => null);
    if (!body) return json({ error: "Invalid JSON body" }, { status: 400 });

    const { projectId, hookUrl, event = "all" } = body as {
      projectId?: string;
      hookUrl?: string;
      event?: string;
    };

    if (!projectId || !hookUrl) {
      return json({ error: "projectId and hookUrl are required" }, { status: 400 });
    }
    if (!VALID_EVENTS.includes(event)) {
      return json(
        { error: `event must be one of: ${VALID_EVENTS.join(", ")}` },
        { status: 400 }
      );
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: user.id },
      select: { id: true },
    });
    if (!project) return json({ error: "Project not found" }, { status: 404 });

    const hook = await prisma.zapierHook.create({
      data: { projectId, hookUrl, event },
    });

    return json({ hook }, { status: 201 });
  }

  if (request.method === "DELETE") {
    const url = new URL(request.url);
    const hookId = url.searchParams.get("hookId");
    if (!hookId) return json({ error: "hookId query param is required" }, { status: 400 });

    const hook = await prisma.zapierHook.findFirst({
      where: { id: hookId, project: { userId: user.id } },
    });
    if (!hook) return json({ error: "Hook not found" }, { status: 404 });

    await prisma.zapierHook.delete({ where: { id: hookId } });
    return json({ success: true });
  }

  return json({ error: "Method not allowed" }, { status: 405 });
}
