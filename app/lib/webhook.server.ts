import { createHmac } from "crypto";
import { prisma } from "~/database/db.server";

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
  const secret = process.env.WEBHOOK_SECRET;
  if (secret) {
    const sig = createHmac('sha256', secret).update(body).digest('hex');
    headers['X-SiteGist-Signature'] = `sha256=${sig}`;
  }

  await fetch(webhookUrl, { method: 'POST', headers, body }).catch(err =>
    console.error(`[Webhook] Failed to deliver ${event} to ${webhookUrl}:`, err)
  );
}

/**
 * Fan-out an event to all delivery targets for a project:
 * 1. The project's generic webhookUrl field (settings page)
 * 2. All ZapierHook REST-Hooks subscriptions for matching event
 * 3. The Zapier Integration paste-URL (legacy integrations page flow)
 */
export async function fireProjectWebhooks(
  projectId: string,
  legacyWebhookUrl: string | null | undefined,
  event: WebhookEvent,
  projectInfo: { id: string; name: string },
  data: Record<string, unknown>
): Promise<void> {
  const urls = new Set<string>();

  if (legacyWebhookUrl) urls.add(legacyWebhookUrl);

  // REST Hooks subscriptions
  const hooks = await prisma.zapierHook.findMany({
    where: {
      projectId,
      OR: [{ event: 'all' }, { event }],
    },
    select: { hookUrl: true },
  });
  for (const h of hooks) urls.add(h.hookUrl);

  // Legacy Zapier paste-URL from Integration table
  const zapierIntegration = await prisma.integration.findUnique({
    where: { projectId_provider: { projectId, provider: 'zapier' } },
    select: { accessToken: true },
  });
  if (zapierIntegration?.accessToken) urls.add(zapierIntegration.accessToken);

  if (urls.size === 0) return;

  await Promise.allSettled([...urls].map(url => sendWebhook(url, event, projectInfo, data)));
}
