import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "~/database/db.server";
import { sendEmail } from "~/lib/email.server";
import { sendWebhook } from "~/lib/webhook.server";
import { notifySlackEscalation } from "~/lib/slack.server";

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

          const slackWebhookUrl = (project.settings as any)?.slackWebhookUrl;
          if (slackWebhookUrl) {
            let lastMessage: string | undefined;
            try {
              const lastMsgDoc = await prisma.message.findFirst({
                where: { sessionId },
                orderBy: { createdAt: "desc" },
                select: { content: true }
              });
              if (lastMsgDoc) {
                lastMessage = lastMsgDoc.content;
              }
            } catch (dbErr) {
              console.error("[Escalation API] DB error fetching last message for Slack preview:", dbErr);
            }

            await notifySlackEscalation(slackWebhookUrl, {
              projectName: project.name,
              projectId: project.id,
              sessionId,
              trigger: 'visitor_requested',
              previewMessage: lastMessage,
            }).catch((err) => {
              console.error("[Escalation API] Slack notification failed:", err);
            });
          }

          // --- Intercom Handoff ---
          const intercomIntegration = await prisma.integration.findUnique({
            where: { projectId_provider: { projectId, provider: "intercom" } },
          });

          if (intercomIntegration) {
            const details = intercomIntegration.details as any;

            // Load chat transcript
            const messages = await prisma.message.findMany({
              where: { sessionId },
              orderBy: { createdAt: "asc" },
              take: 20,
            });

            const transcript = messages
              .map((m) => `**${m.role === "user" ? "Visitor" : "Bot"}:** ${m.content}`)
              .join("\n\n");

            const session = await prisma.chatSession.findUnique({
              where: { id: sessionId },
              select: { customerEmail: true },
            });

            // Find or create an Intercom contact for the visitor
            let contactId: string | undefined;
            if (session?.customerEmail) {
              try {
                const contactRes = await fetch(
                  `https://api.intercom.io/contacts/search`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${intercomIntegration.accessToken}`,
                      "Intercom-Version": "2.10",
                    },
                    body: JSON.stringify({
                      query: { field: "email", operator: "=", value: session.customerEmail },
                    }),
                  }
                );
                if (contactRes.ok) {
                  const contactData = await contactRes.json();
                  contactId = contactData.data?.[0]?.id;
                }

                if (!contactId) {
                  // Create contact if not found
                  const createRes = await fetch("https://api.intercom.io/contacts", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${intercomIntegration.accessToken}`,
                      "Intercom-Version": "2.10",
                    },
                    body: JSON.stringify({ role: "lead", email: session.customerEmail }),
                  });
                  if (createRes.ok) {
                    const created = await createRes.json();
                    contactId = created.id;
                  }
                }
              } catch (contactErr) {
                console.error("[Intercom Escalation] Failed searching/creating contact:", contactErr);
              }
            }

            // Create a new Intercom conversation with the transcript as the first message
            await fetch("https://api.intercom.io/conversations", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${intercomIntegration.accessToken}`,
                "Intercom-Version": "2.10",
              },
              body: JSON.stringify({
                from: contactId
                  ? { type: "contact", id: contactId }
                  : { type: "admin", id: details?.bot_admin_id }, // fallback if no visitor email
                body: `🤖 Chat escalated from ${project.name}\n\n${transcript}`,
              }),
            }).catch((e) => console.error("[Intercom] Failed to create conversation:", e));
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
