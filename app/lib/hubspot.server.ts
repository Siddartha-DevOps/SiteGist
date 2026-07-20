type UpsertHubspotContactOptions = {
  token: string;      // HubSpot Private App access token (Bearer)
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
};

/**
 * Create or update a HubSpot CRM contact keyed by email, using a Private App
 * access token. Creates first; on 409 (contact already exists) updates by email.
 */
export async function upsertHubspotContact(
  opts: UpsertHubspotContactOptions
): Promise<{ id: string } | null> {
  const { token, email, firstName, lastName, phone, company } = opts;
  if (!email) return null;

  const properties: Record<string, string> = { email };
  if (firstName) properties.firstname = firstName;
  if (lastName) properties.lastname = lastName;
  if (phone) properties.phone = phone;
  if (company) properties.company = company;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
    method: "POST",
    headers,
    body: JSON.stringify({ properties }),
  });

  if (res.ok) {
    const data = await res.json();
    return { id: data.id };
  }

  // 409 = contact with this email already exists → update it in place.
  if (res.status === 409) {
    const patch = await fetch(
      `https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(email)}?idProperty=email`,
      { method: "PATCH", headers, body: JSON.stringify({ properties }) }
    );
    if (patch.ok) {
      const data = await patch.json();
      return { id: data.id };
    }
    console.error("[HubSpot] Contact update failed:", patch.status, await patch.text());
    return null;
  }

  console.error("[HubSpot] Contact creation failed:", res.status, await res.text());
  return null;
}
