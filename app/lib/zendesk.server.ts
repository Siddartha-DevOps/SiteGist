type CreateZendeskTicketOptions = {
  subdomain: string;  // "yourcompany" from yourcompany.zendesk.com
  email: string;      // admin email for Basic auth
  apiToken: string;   // Zendesk API token
  subject: string;
  body: string;       // plain text
  requesterEmail?: string;
  requesterName?: string;
  tags?: string[];
};

export async function createZendeskTicket(
  opts: CreateZendeskTicketOptions
): Promise<{ id: number; url: string } | null> {
  const { subdomain, email, apiToken, subject, body, requesterEmail, requesterName, tags } = opts;

  // Zendesk Basic auth: base64("email/token:apiToken")
  const encoded = Buffer.from(`${email}/token:${apiToken}`).toString("base64");

  const payload: Record<string, unknown> = {
    ticket: {
      subject,
      comment: { body },
      tags: ["sitegist", ...(tags || [])],
      priority: "normal",
      status: "open",
    },
  };

  if (requesterEmail) {
    (payload.ticket as any).requester = {
      name: requesterName || requesterEmail,
      email: requesterEmail,
    };
  }

  const res = await fetch(`https://${subdomain}.zendesk.com/api/v2/tickets.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${encoded}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error("[Zendesk] Ticket creation failed:", res.status, await res.text());
    return null;
  }

  const data = await res.json();
  return {
    id: data.ticket.id,
    url: `https://${subdomain}.zendesk.com/agent/tickets/${data.ticket.id}`,
  };
}
