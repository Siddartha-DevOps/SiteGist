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
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-SiteGist-Event': event,
    'X-SiteGist-Timestamp': payload.timestamp,
  };

  // HMAC signature — lets advanced users verify the request is from SiteGist
  // Zapier ignores this header; custom integrations can validate it.
  const secret = process.env.WEBHOOK_SECRET;
  if (secret) {
    const sig = createHmac('sha256', secret).update(body).digest('hex');
    headers['X-SiteGist-Signature'] = `sha256=${sig}`;
  }

  // Deliver with retries + exponential backoff. 4xx (except 429) are permanent
  // client errors and are not retried; 5xx / 429 / network errors are.
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) return;
      if (res.status < 500 && res.status !== 429) {
        console.error(`[Webhook] ${event} rejected with ${res.status} (no retry).`);
        return;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (attempt === maxAttempts) {
        console.error(`[Webhook] Failed to deliver ${event} after ${maxAttempts} attempts:`, err);
        return;
      }
      await new Promise((r) => setTimeout(r, attempt * 500)); // 0.5s, 1s
    }
  }
}
