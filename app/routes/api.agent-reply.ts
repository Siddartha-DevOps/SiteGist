import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireUserId } from "~/backend/auth.server";
import { prisma } from "~/database/db.server";

export async function action({ request }: ActionFunctionArgs) {
  console.log(`[Agent Reply API] Action triggered`);
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  // Require logged in user for dashboard authentication
  const userId = await requireUserId(request);

  try {
    const { sessionId, content } = await request.json();

    if (!sessionId || !content) {
      return json({ error: "Missing required fields (sessionId, content)" }, { status: 400 });
    }

    console.log(`[Agent Reply API] User: ${userId}, Session: ${sessionId}`);

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
      });

      if (!session) {
        return json({ error: "Conversation not found or unauthorized" }, { status: 404 });
      }

      // Create Message
      await prisma.message.create({
        data: {
          sessionId,
          role: "assistant",
          content,
        },
      });

      // Update Session updatedAt
      await prisma.chatSession.update({
        where: { id: sessionId },
        data: {
          updatedAt: new Date(),
        },
      });
    }

    // Broadcast helper via PartyKit
    const partykitHost = process.env.PARTYKIT_HOST;
    if (partykitHost) {
      const cleanHost = partykitHost.replace(/\/$/, "");
      const roomUrl = `${cleanHost.startsWith("http") ? "" : "http://"}${cleanHost}/parties/main/${sessionId}`;
      console.log(`[Agent Reply API] Broadcasting message to PartyKit room URL: ${roomUrl}`);
      try {
        await fetch(roomUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "message",
            role: "assistant",
            content,
          }),
        });
      } catch (partyErr) {
        console.error("[Agent Reply API] Error broadcasting to PartyKit:", partyErr);
      }
    } else {
      console.warn("[Agent Reply API] PARTYKIT_HOST is not set; skipping real-time broadcast.");
    }

    return json({ ok: true });
  } catch (err: any) {
    console.error("[Agent Reply API] Fatal error:", err);
    return json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
