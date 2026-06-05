import { createHmac } from "crypto";

export type WebhookEvent =
  | 'lead.captured'
  | 'conversation.escalated'
  | 'conversation.resolved'
  | 'message.received';

export type WebhookPayload = {
  event: WebhookEvent;
  timestamp: string;
  project: { id: string; name: string };
  data: Record<string, unknown>;
};

export async function sendWebhook(
  webhookUrl: string,
  event: WebhookEvent,
  project: { id: string; name: string },
  data: Record<string, unknown>
): Promise<void> {
  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    project,
    data,
  };

  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  // HMAC signature — lets advanced users verify the request is from SiteGist
  // Zapier ignores this header; custom integrations can validate it
  const secret = process.env.WEBHOOK_SECRET;
  if (secret) {
    const sig = createHmac('sha256', secret).update(body).digest('hex');
    headers['X-SiteGist-Signature'] = `sha256=${sig}`;
  }

  await fetch(webhookUrl, { method: 'POST', headers, body }).catch(err =>
    console.error(`[Webhook] Failed to deliver ${event}:`, err)
  );
}
