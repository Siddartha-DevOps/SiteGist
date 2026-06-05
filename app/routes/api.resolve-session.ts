import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireUserId } from "~/backend/auth.server";
import { prisma } from "~/database/db.server";
import { sendWebhook } from "~/lib/webhook.server";

export async function action({ request }: ActionFunctionArgs) {
  console.log(`[Resolve Session API] Action triggered`);
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  // Require logged in user for dashboard authentication
  const userId = await requireUserId(request);

  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return json({ error: "Missing required fields (sessionId)" }, { status: 400 });
    }

    const isDemo = sessionId === "demo-session";

    if (!isDemo) {
      // Validate that this conversation belongs to the user's project
      const session = await prisma.chatSession.findFirst({
        where: {
          id: sessionId,
          project: {
            userId,
          },
        },
        include: {
          project: true,
        },
      });

      if (!session) {
        return json({ error: "Conversation not found or unauthorized" }, { status: 404 });
      }

      // Update session: mode: 'ai', status: 'resolved'
      await prisma.chatSession.update({
        where: { id: sessionId },
        data: {
          mode: "ai",
          status: "resolved",
          updatedAt: new Date(),
        },
      });

      if (session.project.webhookUrl) {
        await sendWebhook(session.project.webhookUrl, 'conversation.resolved', {
          id: session.project.id,
          name: session.project.name,
        }, {
          session: { id: sessionId, resolvedAt: new Date().toISOString() },
        });
      }
    }

    // Broadcast resolved event via PartyKit
    const partykitHost = process.env.PARTYKIT_HOST;
    if (partykitHost) {
      const cleanHost = partykitHost.replace(/\/$/, "");
      const roomUrl = `${cleanHost.startsWith("http") ? "" : "http://"}${cleanHost}/parties/main/${sessionId}`;
      console.log(`[Resolve Session API] Broadcasting resolved status to: ${roomUrl}`);
      try {
        await fetch(roomUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "resolved",
            sessionId,
          }),
        });
      } catch (partyErr) {
        console.error("[Resolve Session API] Error broadcasting to PartyKit:", partyErr);
      }
    }

    return json({ ok: true });
  } catch (err: any) {
    console.error("[Resolve Session API] Fatal error:", err);
    return json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
