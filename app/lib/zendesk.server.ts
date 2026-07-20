type CreateZendeskTicketOptions = {
  subdomain: string;     // "yourcompany" from yourcompany.zendesk.com
  email: string;         // agent email paired with the API token
  apiToken: string;
  subject: string;
  description: string;   // HTML allowed (sent as comment.html_body)
  requesterEmail?: string;
  requesterName?: string;
  tags?: string[];
};

/**
 * Create a Zendesk Support ticket via the API-token auth scheme
 * (Basic base64("{email}/token:{apiToken}")). Mirrors createFreshdeskTicket.
 */
export async function createZendeskTicket(
  opts: CreateZendeskTicketOptions
): Promise<{ id: number; url: string } | null> {
  const { subdomain, email, apiToken, subject, description, requesterEmail, requesterName, tags } = opts;

  const encoded = Buffer.from(`${email}/token:${apiToken}`).toString("base64");

  const ticket: Record<string, unknown> = {
    subject,
    comment: { html_body: description },
    tags: ["sitegist", ...(tags || [])],
  };
  if (requesterEmail) {
    ticket.requester = { email: requesterEmail, name: requesterName || requesterEmail.split("@")[0] };
  }

  const res = await fetch(`https://${subdomain}.zendesk.com/api/v2/tickets.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${encoded}`,
    },
    body: JSON.stringify({ ticket }),
  });

  if (!res.ok) {
    console.error("[Zendesk] Ticket creation failed:", res.status, await res.text());
    return null;
  }

  const data = await res.json();
  const id = data.ticket?.id;
  return { id, url: `https://${subdomain}.zendesk.com/agent/tickets/${id}` };
}
