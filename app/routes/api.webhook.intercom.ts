import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { prisma } from "~/database/db.server";
import { streamRAG } from "~/ai-layer/ai.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Verify Intercom webhook signature (X-Hub-Signature: sha1=...)
  const sig = request.headers.get("x-hub-signature");
  if (sig && process.env.INTERCOM_CLIENT_SECRET) {
    const { createHmac } = await import("crypto");
    const rawBody = JSON.stringify(body);
    const expected = "sha1=" + createHmac("sha1", process.env.INTERCOM_CLIENT_SECRET)
      .update(rawBody).digest("hex");
    if (sig !== expected) {
      return json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const topic: string = body.topic;
  // Only handle user messages in conversations
  if (topic !== "conversation.user.created" && topic !== "conversation.user.replied") {
    return json({ ok: true });
  }

  const conversation = body.data?.item;
  const conversationId: string = conversation?.id;
  if (!conversationId) return json({ ok: true });

  // Extract the latest user message context
  const latestPart = conversation?.conversation_parts?.conversation_parts?.[0];
  const source = conversation?.source;

  // Prevent loops from other admin replies or bot automated rules
  const authorType = topic === "conversation.user.created" 
    ? conversation?.source?.author?.type 
    : latestPart?.author?.type;
  
  if (authorType === "admin" || authorType === "bot") {
    return json({ ok: true });
  }

  const messageText: string =
    (topic === "conversation.user.created" ? source?.body : latestPart?.body) || "";

  // Strip basic HTML from Intercom message body
  const cleanText = messageText.replace(/<[^>]+>/g, " ").trim();
  if (!cleanText) return json({ ok: true });

  // Map Intercom workspace_id to SiteGist project
  const workspaceId: string = conversation?.workspace_id || body.app_id || "";
  if (!workspaceId) return json({ ok: true });

  // Find matching integration by workspace_id in details
  const allIntercomIntegrations = await prisma.integration.findMany({
    where: { provider: "intercom" },
    include: { project: true },
  });
  const matched = allIntercomIntegrations.find(
    (i) => (i.details as any)?.workspace_id === workspaceId
  );
  if (!matched) return json({ ok: true }); // no project mapped to this workspace

  const project = matched.project;
  const settings = project.settings as any;
  const systemPrompt = settings?.systemPrompt || "You are a helpful assistant for this website. Answer based on the content provided.";

  // Generate AI response using RAG
  let fullAnswer = "";
  try {
    for await (const chunk of streamRAG(project.id, cleanText, systemPrompt, [], settings?.model)) {
      if (chunk.startsWith("METADATA:")) continue;
      if (chunk.startsWith("[ERROR]")) { fullAnswer = ""; break; }
      fullAnswer += chunk;
    }
  } catch (e) {
    console.error("[Intercom Webhook] RAG error:", e);
    return json({ ok: true });
  }

  if (!fullAnswer.trim()) return json({ ok: true });

  // Post AI reply back into the Intercom conversation
  // Use the cached bot_admin_id if available, or fetch
  let adminId = (matched.details as any)?.bot_admin_id;
  if (!adminId) {
    try {
      const adminsRes = await fetch("https://api.intercom.io/admins", {
        headers: {
          Authorization: `Bearer ${matched.accessToken}`,
          "Intercom-Version": "2.10",
        },
      });
      if (adminsRes.ok) {
        const adminsData = await adminsRes.json();
        adminId = adminsData.admins?.[0]?.id || adminsData.id;
        
        // Cache the newly retrieved bot_admin_id
        await prisma.integration.update({
          where: { id: matched.id },
          data: {
            details: {
              ...(matched.details as any),
              bot_admin_id: adminId,
            }
          }
        });
      }
    } catch (adminErr) {
      console.error("[Intercom Webhook] Failed to fetch admins as fallback:", adminErr);
    }
  }

  if (!adminId) {
    console.error("[Intercom Webhook] No adminId to send reply as.");
    return json({ ok: true });
  }

  const replyRes = await fetch(`https://api.intercom.io/conversations/${conversationId}/reply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${matched.accessToken}`,
      "Intercom-Version": "2.10",
    },
    body: JSON.stringify({
      message_type: "comment",
      type: "admin",
      admin_id: adminId,
      body: fullAnswer,
    }),
  });

  if (!replyRes.ok) {
    console.error(`[Intercom Webhook] Failed to reply to conversation ${conversationId}:`, await replyRes.text());
  }

  return json({ ok: true });
}
