import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { requireUserId } from "~/backend/auth.server";
import { prisma } from "~/database/db.server";
import { sendWebhook } from "~/lib/webhook.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, { status: 405 });
  }

  try {
    const userId = await requireUserId(request);
    const { projectId } = await request.json();

    if (!projectId) {
      return json({ ok: false, error: "Missing projectId" }, { status: 400 });
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
      select: { id: true, name: true, webhookUrl: true },
    });

    if (!project) {
      return json({ ok: false, error: "Project not found or unauthorized" }, { status: 404 });
    }

    if (!project.webhookUrl) {
      return json({ ok: false, error: "No webhook URL configured" }, { status: 400 });
    }

    await sendWebhook(project.webhookUrl, 'lead.captured', {
      id: project.id,
      name: project.name,
    }, {
      lead: {
        id: 'test_lead_id',
        name: 'Jane Test',
        email: 'jane@example.com',
        phone: '+1 555-0100',
        company: 'Acme Corp',
        customFields: { 'Company size': 'Medium (11–50)', 'Budget size': '$10k-$50k' },
        createdAt: new Date().toISOString(),
      },
      session: { id: 'test_session_id' },
      _isTest: true,
    });

    return json({ ok: true });
  } catch (err: any) {
    console.error("[Webhook Test API] Error:", err);
    return json({ ok: false, error: err.message || "Failed to trigger test webhook" }, { status: 500 });
  }
}
