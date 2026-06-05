import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "~/database/db.server";
import { sendEmail } from "~/lib/email.server";

export async function action({ request }: ActionFunctionArgs) {
  const body = await request.json();
  const { projectId, name, email, phone, company, sessionId } = body;

  if (!projectId || !email) {
    return json({ error: "Project ID and Email are required" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) {
    return json({ error: "Project not found" }, { status: 404 });
  }

  // Collect custom field answers — keys prefixed with "custom_"
  const customAnswers: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (key.startsWith('custom_') && value) {
      customAnswers[key] = value as string;
    }
  }

  // Resolve custom_<id> → human-readable label using project.settings.leadFields
  const leadFields = (project.settings as any)?.leadFields || [];
  const labelledAnswers: Record<string, string> = {};
  for (const [key, value] of Object.entries(customAnswers)) {
    const fieldId = key.replace('custom_', '');
    const field = leadFields.find((f: any) => f.id === fieldId);
    labelledAnswers[field?.label || fieldId] = value;
  }

  const notes = Object.keys(labelledAnswers).length
    ? JSON.stringify(labelledAnswers)
    : undefined;

  const lead = await prisma.lead.create({
    include: { project: true },
    data: {
      projectId,
      name,
      email,
      phone,
      company,
      notes,
      ...(sessionId ? { sessionId } : {}),
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

  // Email the chatbot owner about the new lead (default ON, never blocks lead capture)
  try {
    const settings = (lead.project.settings as any) || {};
    const notifyOnLead = settings?.notifications?.emailOnLead !== false; // default ON
    if (notifyOnLead) {
      const owner = await prisma.user.findUnique({
        where: { id: lead.project.userId },
        select: { email: true },
      });
      if (owner?.email) {
        await sendEmail({
          to: owner.email,
          subject: `New lead captured on ${lead.project.name}`,
          html: `
            <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto;">
              <h2 style="color:#155DEE; margin-bottom:4px;">New lead captured 🎉</h2>
              <p style="color:#52525b; margin-top:0;">Your chatbot <strong>${lead.project.name}</strong> just captured a new lead.</p>
              <table style="width:100%; border-collapse:collapse; margin:20px 0;">
                <tr><td style="padding:8px 0; color:#a1a1aa;">Name</td><td style="padding:8px 0; font-weight:bold;">${name || "—"}</td></tr>
                <tr><td style="padding:8px 0; color:#a1a1aa;">Email</td><td style="padding:8px 0; font-weight:bold;">${email}</td></tr>
                <tr><td style="padding:8px 0; color:#a1a1aa;">Phone</td><td style="padding:8px 0; font-weight:bold;">${phone || "—"}</td></tr>
                <tr><td style="padding:8px 0; color:#a1a1aa;">Company</td><td style="padding:8px 0; font-weight:bold;">${company || "—"}</td></tr>
              </table>
              <p style="color:#a1a1aa; font-size:12px;">Sent by SiteGist · You can manage notifications in your chatbot settings.</p>
            </div>
          `,
        });
      }
    }
  } catch (e) {
    console.error("Lead email notification failed:", e);
  }

  return json({ success: true, lead });
}
