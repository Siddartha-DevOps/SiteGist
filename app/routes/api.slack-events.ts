import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { createHmac } from "crypto";
import { prisma } from "~/database/db.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 });

  const rawBody = await request.text();
  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Handle Slack URL verification challenge (happens once at app setup)
  if (body.type === "url_verification") {
    return json({ challenge: body.challenge });
  }

  // Identify workspace
  const teamId = body.team_id || body.event?.team;
  if (!teamId) return json({ ok: true });

  // Find the slack_bot integration for this workspace
  const integrations = await prisma.integration.findMany({
    where: { provider: "slack_bot" },
    include: { project: { select: { id: true, settings: true } } },
  });
  const integration = integrations.find(
    (i) => (i.details as any)?.workspaceId === teamId
  );
  if (!integration) return json({ ok: true }); // Unknown workspace — ignore

  // Verify Slack signature
  const timestamp = request.headers.get("X-Slack-Request-Timestamp");
  const signature = request.headers.get("X-Slack-Signature");
  const signingSecret = (integration.details as any)?.signingSecret as string | undefined;

  if (timestamp && signature && signingSecret) {
    const age = Math.abs(Date.now() / 1000 - parseInt(timestamp, 10));
    if (age > 300) return json({ error: "Request too old" }, { status: 400 });

    const expected = "v0=" + createHmac("sha256", signingSecret)
      .update(`v0:${timestamp}:${rawBody}`)
      .digest("hex");

    if (signature !== expected) return json({ error: "Invalid signature" }, { status: 401 });
  }

  // Process events asynchronously so Slack gets an immediate 200
  if (body.type === "event_callback") {
    const event = body.event;

    // Ignore bot's own messages and sub-types
    if (event.bot_id || event.subtype === "bot_message") return json({ ok: true });
    if (event.type !== "app_mention" && event.type !== "message") return json({ ok: true });
    if (event.type === "message" && event.channel_type !== "im") return json({ ok: true });

    const botUserId = (integration.details as any)?.botUserId as string | undefined;
    const messageText = (event.text || "")
      .replace(`<@${botUserId ?? ""}>`, "")
      .trim();

    if (!messageText) return json({ ok: true });

    const projectId = integration.projectId;
    const botToken = integration.accessToken;
    const channel = event.channel as string;
    const threadTs = (event.thread_ts || event.ts) as string;
    const systemPrompt = (integration.project.settings as any)?.systemPrompt as string | undefined;

    // Fire-and-forget — don't block the 200 response to Slack
    (async () => {
      try {
        const { streamRAG } = await import("~/ai-layer/ai.server");
        let fullResponse = "";
        for await (const chunk of streamRAG(projectId, messageText, systemPrompt)) {
          if (!chunk.startsWith("METADATA:")) fullResponse += chunk;
        }
        await fetch("https://slack.com/api/chat.postMessage", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${botToken}`,
          },
          body: JSON.stringify({
            channel,
            text: fullResponse || "Sorry, I couldn't generate a response. Please try again.",
            thread_ts: threadTs,
          }),
        });
      } catch (err) {
        console.error("[Slack Bot] Error responding:", err);
      }
    })();
  }

  return json({ ok: true });
}
