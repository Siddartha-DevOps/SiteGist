import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "~/database/db.server";

export async function action({ request }: ActionFunctionArgs) {
  const body = await request.json();
  const { projectId, name, email, phone, company } = body;

  if (!projectId || !email) {
    return json({ error: "Project ID and Email are required" }, { status: 400 });
  }

  const lead = await prisma.lead.create({
    include: { project: true },
    data: {
      projectId,
      name,
      email,
      phone,
      company,
    },
  });

  // Feature 3: Real-Time Notifications
  if (lead.project.webhookUrl) {
    try {
      await fetch(lead.project.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "lead.captured",
          project: { id: projectId, name: lead.project.name },
          lead: { name, email, phone, company },
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (e) {
      console.error("Webhook notification failed:", e);
    }
  }

  return json({ success: true, lead });
}
