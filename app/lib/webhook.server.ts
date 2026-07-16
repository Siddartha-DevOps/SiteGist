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

// -----------------------------------------------------------------------------
// Documented per-event payload schemas. The `data` field of WebhookPayload takes
// one of these shapes depending on `event`. Exported so producers, the API docs,
// and integrators share a single source of truth.
// -----------------------------------------------------------------------------
export interface MessageReceivedData {
  session: { id: string };
  message: { id: string; role: 'user' | 'assistant'; content: string; createdAt: string };
}
export interface ConversationEscalatedData {
  session: { id?: string };
  trigger: string;            // e.g. 'keyword_match' | 'visitor_requested'
  message?: string;
  assignedTo?: string;
}
export interface ConversationResolvedData {
  session: { id: string; resolvedAt: string };
}
export interface LeadCapturedData {
  lead: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    company?: string | null;
    customFields?: Record<string, unknown>;
    createdAt: string | Date;
    sessionId?: string | null;
  };
}
export type WebhookEventData = {
  'message.received': MessageReceivedData;
  'conversation.escalated': ConversationEscalatedData;
  'conversation.resolved': ConversationResolvedData;
  'lead.captured': LeadCapturedData;
};

// Default subscription: high-volume message events are OFF by default; the rest ON
// (preserves existing behaviour — escalated/resolved/lead have always fired).
export const DEFAULT_WEBHOOK_EVENTS: Record<WebhookEvent, boolean> = {
  'message.received': false,
  'conversation.escalated': true,
  'conversation.resolved': true,
  'lead.captured': true,
};

/**
 * Whether a project has subscribed to a given webhook event. Reads
 * `settings.webhookEvents` (a `Record<WebhookEvent, boolean>`); falls back to the
 * defaults above when unset, so existing projects keep receiving escalation/lead/
 * resolved events without any config.
 */
export function webhookEventEnabled(settings: any, event: WebhookEvent): boolean {
  const cfg = settings?.webhookEvents;
  if (cfg && typeof cfg[event] === 'boolean') return cfg[event];
  return DEFAULT_WEBHOOK_EVENTS[event];
}

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
