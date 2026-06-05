type CreateFreshdeskTicketOptions = {
  domain: string;       // "yourcompany" from yourcompany.freshdesk.com
  apiKey: string;
  subject: string;
  description: string;  // HTML allowed
  requesterEmail: string; // Freshdesk REQUIRES an email to create a ticket
  tags?: string[];
};

export async function createFreshdeskTicket(
  opts: CreateFreshdeskTicketOptions
): Promise<{ id: number; url: string } | null> {
  const { domain, apiKey, subject, description, requesterEmail, tags } = opts;

  // Basic auth: base64("apikey:X")
  const encoded = Buffer.from(`${apiKey}:X`).toString("base64");

  const body = {
    subject,
    description,
    email: requesterEmail,   // required by Freshdesk
    priority: 1,             // 1=Low, 2=Medium, 3=High, 4=Urgent
    status: 2,               // 2=Open
    tags: ["sitegist", ...(tags || [])],
  };

  const res = await fetch(`https://${domain}.freshdesk.com/api/v2/tickets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${encoded}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error("[Freshdesk] Ticket creation failed:", res.status, await res.text());
    return null;
  }

  const data = await res.json();
  return {
    id: data.id,
    url: `https://${domain}.freshdesk.com/a/tickets/${data.id}`,
  };
}
