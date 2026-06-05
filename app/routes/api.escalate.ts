import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "~/database/db.server";
import { sendEmail } from "~/lib/email.server";
import { sendWebhook } from "~/lib/webhook.server";

export async function action({ request }: ActionFunctionArgs) {
  console.log(`[Escalation API] Action triggered`);
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { sessionId, projectId } = await request.json();

    if (!sessionId || !projectId) {
      return json({ error: "Missing required fields" }, { status: 400 });
    }

    console.log(`[Escalation API] Processing sessionId: ${sessionId}, projectId: ${projectId}`);

    const isDemo = projectId === "demo-project" || sessionId === "demo-session";

    if (!isDemo) {
      // 1. Set ChatSession.mode = 'human', ChatSession.isRead = false
      try {
        await prisma.chatSession.update({
          where: { id: sessionId },
          data: {
            mode: "human",
            isRead: false,
            updatedAt: new Date(),
          },
        });
      } catch (dbErr) {
        console.error("[Escalation API] DB error setting mode to human:", dbErr);
      }

      // 2. Load project + owner user
      try {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          include: { user: true },
        });

        if (project) {
          // 3. Send email to owner
          const ownerEmail = project.user.email;
          await sendEmail({
            to: ownerEmail,
            subject: `[SiteGist] Human handoff requested — ${project.name}`,
            html: `<p>A visitor on <strong>${project.name}</strong> requested a live agent.</p>
                   <p><a href="https://app.sitegist.co/dashboard/inbox/${sessionId}">Open conversation →</a></p>`,
          }).catch((emailErr) => {
            console.error("[Escalation API] Error sending email notification:", emailErr);
          });

          // 4. Fire project.webhookUrl if set (same pattern as existing handoff webhook)
          if (project.webhookUrl) {
            console.log(`[Escalation API] Triggering webhook for project: ${project.name}`);
            await sendWebhook(project.webhookUrl, 'conversation.escalated', {
              id: project.id,
              name: project.name,
            }, {
              session: { id: sessionId },
              trigger: 'visitor_requested',
            });
          }
        }
      } catch (projErr) {
        console.error("[Escalation API] DB error fetching project & user details:", projErr);
      }
    }

    // 5. Broadcast via PartyKit to room `sessionId` so the Inbox/widget updates live
    const partykitHost = process.env.PARTYKIT_HOST;
    if (partykitHost) {
      const cleanHost = partykitHost.replace(/\/$/, "");
      const roomUrl = `${cleanHost.startsWith("http") ? "" : "http://"}${cleanHost}/parties/main/${sessionId}`;
      console.log(`[Escalation API] PartyKit URL: ${roomUrl}`);
      try {
        await fetch(roomUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "escalated",
            sessionId,
            mode: "human",
          }),
        });
      } catch (partyErr) {
        console.error("[Escalation API] Error broadcasting to PartyKit:", partyErr);
      }
    } else {
      console.warn("[Escalation API] PARTYKIT_HOST is not set; skipping broadcast.");
    }

    return json({ ok: true });
  } catch (err: any) {
    console.error("[Escalation API] Fatal error:", err);
    return json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
