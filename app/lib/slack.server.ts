type SlackLeadPayload = {
  projectName: string;
  projectId: string;
  lead: { name?: string; email?: string; phone?: string; company?: string };
  sessionId?: string;
};

type SlackEscalationPayload = {
  projectName: string;
  projectId: string;
  sessionId: string;
  trigger: 'visitor_requested' | 'keyword_match';
  previewMessage?: string;
};

export async function notifySlackLeadCaptured(
  webhookUrl: string,
  payload: SlackLeadPayload
): Promise<void> {
  const { projectName, lead, sessionId } = payload;
  const inboxUrl = `https://app.sitegist.co/dashboard/inbox/${sessionId || ''}`;

  const body = {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:incoming_envelope: *New lead captured on ${projectName}*`,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Name:*\n${lead.name || '—'}` },
          { type: 'mrkdwn', text: `*Email:*\n${lead.email || '—'}` },
          { type: 'mrkdwn', text: `*Phone:*\n${lead.phone || '—'}` },
          { type: 'mrkdwn', text: `*Company:*\n${lead.company || '—'}` },
        ],
      },
      ...(sessionId ? [{
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View conversation' },
            url: inboxUrl,
            style: 'primary',
          }
        ],
      }] : []),
    ],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`[Slack] Slack endpoint response error ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    console.error('[Slack] Lead notification failed:', err);
  }
}

export async function notifySlackEscalation(
  webhookUrl: string,
  payload: SlackEscalationPayload
): Promise<void> {
  const { projectName, sessionId, trigger, previewMessage } = payload;
  const inboxUrl = `https://app.sitegist.co/dashboard/inbox/${sessionId}`;
  const triggerLabel = trigger === 'visitor_requested'
    ? 'Visitor clicked "Talk to a human"'
    : 'Keyword match in message';

  const body = {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:sos: *Human handoff requested on ${projectName}*\n${triggerLabel}`,
        },
      },
      ...(previewMessage ? [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Last message:*\n> ${previewMessage.slice(0, 200)}`,
          },
        }
      ] : []),
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Open in Inbox' },
            url: inboxUrl,
            style: 'danger',
          }
        ],
      },
    ],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`[Slack] Slack endpoint response error ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    console.error('[Slack] Escalation notification failed:', err);
  }
}
