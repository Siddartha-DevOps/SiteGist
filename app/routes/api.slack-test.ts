import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { requireUserId } from "~/backend/auth.server";
import { prisma } from "~/database/db.server";
import { notifySlackLeadCaptured } from "~/lib/slack.server";

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
      select: { id: true, name: true, settings: true },
    });

    if (!project) {
      return json({ ok: false, error: "Project not found or unauthorized" }, { status: 404 });
    }

    const slackWebhookUrl = (project.settings as any)?.slackWebhookUrl;
    if (!slackWebhookUrl) {
      return json({ ok: false, error: "No Slack webhook URL configured" }, { status: 400 });
    }

    await notifySlackLeadCaptured(slackWebhookUrl, {
      projectName: project.name,
      projectId: project.id,
      lead: {
        name: "Jane Test",
        email: "jane@example.com",
        phone: "+1 555-0100",
        company: "Acme Corp",
      },
      sessionId: "test_session_id",
    });

    return json({ ok: true });
  } catch (err: any) {
    console.error("[Slack Test API] Error:", err);
    return json({ ok: false, error: err.message || "Failed to trigger Slack test notification" }, { status: 500 });
  }
}
