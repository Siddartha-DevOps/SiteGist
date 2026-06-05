import { prisma } from "~/database/db.server";

interface ZohoIntegration {
  id: string;
  accessToken: string;
  refreshToken: string | null;
  details: any;
}

async function getValidZohoToken(integration: ZohoIntegration): Promise<string> {
  const expiresAt = integration.details?.expiresAt ?? 0;
  if (Date.now() < expiresAt - 60_000) return integration.accessToken; // still valid

  const oauthUrl = process.env.ZOHO_ACCOUNTS_URL || "https://accounts.zoho.com";
  console.log(`[Zoho] Token expired, refreshing using: ${oauthUrl}/oauth/v2/token`);

  try {
    const res = await fetch(`${oauthUrl}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.ZOHO_CLIENT_ID!,
        client_secret: process.env.ZOHO_CLIENT_SECRET!,
        refresh_token: integration.refreshToken!,
      }),
    });

    const data = await res.json();

    if (res.ok && data.access_token) {
      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          accessToken: data.access_token,
          details: {
            ...integration.details,
            expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
          },
        },
      });
      return data.access_token;
    } else {
      console.error("[Zoho] Token refresh payload failing:", data);
      return integration.accessToken;
    }
  } catch (error) {
    console.error("[Zoho] Error during token refresh:", error);
    return integration.accessToken;
  }
}

export async function createZohoTicket(opts: {
  integration: ZohoIntegration;
  subject: string;
  description: string;
  contactEmail?: string;
  contactName?: string;
}): Promise<{ id: string } | null> {
  const { integration, subject, description, contactEmail, contactName } = opts;
  
  const token = await getValidZohoToken(integration);
  const details = integration.details || {};
  const orgId = details.orgId;
  const departmentId = details.departmentId;
  const base = process.env.ZOHO_DESK_URL || "https://desk.zoho.com";

  if (!orgId || !departmentId) {
    console.error("[Zoho] Missing orgId or departmentId in integration details.", details);
    return null;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Zoho-oauthtoken ${token}`,
    orgId,
  };

  // Zoho requires a contactId — look up or create the contact first
  let contactId: string | undefined;
  if (contactEmail) {
    try {
      const searchUrl = `${base}/api/v1/contacts/search?email=${encodeURIComponent(contactEmail)}`;
      console.log(`[Zoho] Searching contact via: ${searchUrl}`);
      const search = await fetch(searchUrl, { headers });
      
      if (search.ok) {
        const found = await search.json();
        contactId = found.data?.[0]?.id;
      } else {
        console.warn("[Zoho] Contact search failed:", search.status, await search.text());
      }

      if (!contactId) {
        console.log(`[Zoho] Contact not found, creating one for: ${contactEmail}`);
        const create = await fetch(`${base}/api/v1/contacts`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            lastName: contactName || contactEmail.split("@")[0] || "Visitor",
            email: contactEmail,
          }),
        });
        if (create.ok) {
          const created = await create.json();
          contactId = created.id;
        } else {
          console.error("[Zoho] Contact creation failed:", create.status, await create.text());
        }
      }
    } catch (contactErr) {
      console.error("[Zoho] Contact helper error:", contactErr);
    }
  }

  if (!contactId) {
    console.error("[Zoho] Cannot create ticket without a contact (no visitor email or lookup failed).");
    return null;
  }

  try {
    const res = await fetch(`${base}/api/v1/tickets`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        subject,
        description,
        departmentId,
        contactId,
      }),
    });

    if (!res.ok) {
      console.error("[Zoho] Ticket creation failed:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return { id: data.id };
  } catch (ticketErr) {
    console.error("[Zoho] Ticket request failed:", ticketErr);
    return null;
  }
}
