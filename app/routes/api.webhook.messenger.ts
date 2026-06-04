import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "~/database/db.server";
import { streamRAG } from "~/ai-layer/ai.server";

const GRAPH_API = "https://graph.facebook.com/v18.0";

// Facebook verifies the webhook with a GET request before sending events.
// Must return hub.challenge as plain text when hub.verify_token matches our secret.
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.MESSENGER_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

// Facebook sends all message events as POST
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

  if (body?.object !== "page") return json({ ok: true });

  for (const entry of body.entry || []) {
    for (const messaging of entry.messaging || []) {
      // Only handle real incoming user text messages — ignore echoes and postbacks
      if (!messaging.message?.text || messaging.message?.is_echo) continue;

      const senderPsid = messaging.sender?.id as string;
      const pageId = messaging.recipient?.id as string;
      const text = messaging.message.text as string;

      if (!senderPsid || !pageId || !text) continue;

      // Match page_id -> SiteGist project via stored Integration
      const all = await prisma.integration.findMany({ where: { provider: "messenger" } });
      const integration = all.find(i => (i.details as any)?.page_id === pageId) || null;
      if (!integration) continue;

      const project = await prisma.project.findUnique({ where: { id: integration.projectId } });
      if (!project) continue;

      const settings = (project.settings as any) || {};
      const systemPrompt =
        settings.systemPrompt ||
        "You are a helpful assistant for this website. Answer based on the content provided.";

      // Generate answer using SiteGist's existing RAG engine
      let answer = "";
      try {
        for await (const chunk of streamRAG(project.id, text, systemPrompt, [])) {
          if (chunk.startsWith("METADATA:")) continue;
          if (chunk.startsWith("[ERROR]")) { answer = ""; break; }
          answer += chunk;
        }
      } catch (e) {
        console.error("[Messenger] RAG error:", e);
        continue;
      }

      if (!answer.trim()) continue;

      // Reply inside the Messenger conversation
      try {
        await fetch(
          `${GRAPH_API}/me/messages?access_token=${integration.accessToken}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipient: { id: senderPsid },
              message: { text: answer },
            }),
          }
        );
      } catch (e) {
        console.error("[Messenger] Failed to send reply:", e);
      }
    }
  }

  // Facebook requires a 200 OK quickly or it retries
  return json({ ok: true });
}
