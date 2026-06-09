import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "~/database/db.server";
import { requireApiKey } from "~/backend/api-auth.server";

// GET /api/zapier/leads?projectId=xxx&limit=3
// Returns recent leads shaped like the lead.captured webhook payload.
// Zapier uses this endpoint for sample data when setting up a Zap.
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireApiKey(request);
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "3", 10), 25);

  if (!projectId) {
    return json({ error: "projectId query param is required" }, { status: 400 });
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id },
    select: { id: true, name: true },
  });
  if (!project) return json({ error: "Project not found" }, { status: 404 });

  const leads = await prisma.lead.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      company: true,
      status: true,
      notes: true,
      sessionId: true,
      createdAt: true,
    },
  });

  const data = leads.map(lead => ({
    event: "lead.captured",
    timestamp: lead.createdAt.toISOString(),
    project: { id: project.id, name: project.name },
    data: {
      lead: {
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        company: lead.company,
        status: lead.status,
        customFields: tryParseJson(lead.notes),
        createdAt: lead.createdAt,
      },
      session: { id: lead.sessionId },
    },
  }));

  return json(data);
}

function tryParseJson(str: string | null): Record<string, unknown> {
  if (!str) return {};
  try { return JSON.parse(str); } catch { return {}; }
}
