type CreateHubspotContactOptions = {
  apiKey: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
};

export async function createOrUpdateHubspotContact(
  opts: CreateHubspotContactOptions
): Promise<{ id: string } | null> {
  const { apiKey, email, firstName, lastName, phone, company } = opts;

  const properties: Record<string, string> = { email };
  if (firstName) properties.firstname = firstName;
  if (lastName) properties.lastname = lastName;
  if (phone) properties.phone = phone;
  if (company) properties.company = company;

  const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ properties }),
  });

  if (res.ok) {
    const data = await res.json();
    return { id: data.id };
  }

  // 409 = contact already exists — find and return their ID
  if (res.status === 409) {
    const searchRes = await fetch(
      "https://api.hubapi.com/crm/v3/objects/contacts/search",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          filterGroups: [
            { filters: [{ propertyName: "email", operator: "EQ", value: email }] },
          ],
          limit: 1,
        }),
      }
    );
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const existing = searchData.results?.[0];
      if (existing) {
        await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${existing.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ properties }),
        });
        return { id: existing.id };
      }
    }
  }

  console.error("[HubSpot] Contact upsert failed:", res.status, await res.text());
  return null;
}
