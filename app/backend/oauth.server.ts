import { redirect } from "@remix-run/node";
import axios from "axios";
import { prisma } from "~/database/db.server";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

// --- Notion ---
export const NOTION_AUTH_URL = "https://api.notion.com/v1/oauth/authorize";
export const NOTION_TOKEN_URL = "https://api.notion.com/v1/oauth/token";

export function getNotionAuthUrl(projectId: string) {
  const clientId = process.env.NOTION_CLIENT_ID;
  if (!clientId) throw new Error("NOTION_CLIENT_ID is missing");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${APP_URL}/api/auth/notion/callback`,
    response_type: "code",
    owner: "user",
    state: projectId, // Pass projectId in state
  });

  return `${NOTION_AUTH_URL}?${params.toString()}`;
}

export async function exchangeNotionCode(code: string, projectId: string) {
  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await axios.post(
    NOTION_TOKEN_URL,
    {
      grant_type: "authorization_code",
      code,
      redirect_uri: `${APP_URL}/api/auth/notion/callback`,
    },
    {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
    }
  );

  const data = response.data;

  await prisma.integration.upsert({
    where: { projectId_provider: { projectId, provider: "notion" } },
    update: {
      accessToken: data.access_token,
      details: {
        workspace_name: data.workspace_name,
        workspace_icon: data.workspace_icon,
        workspace_id: data.workspace_id,
        bot_id: data.bot_id,
      },
    },
    create: {
      projectId,
      provider: "notion",
      accessToken: data.access_token,
      details: {
        workspace_name: data.workspace_name,
        workspace_icon: data.workspace_icon,
        workspace_id: data.workspace_id,
        bot_id: data.bot_id,
      },
    },
  });

  return data;
}

// --- Google Drive ---
export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export function getGoogleAuthUrl(projectId: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is missing");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${APP_URL}/api/auth/google/callback`,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/drive.readonly",
    access_type: "offline",
    prompt: "consent",
    state: projectId,
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string, projectId: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  const response = await axios.post(GOOGLE_TOKEN_URL, {
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: `${APP_URL}/api/auth/google/callback`,
  });

  const data = response.data;

  await prisma.integration.upsert({
    where: { projectId_provider: { projectId, provider: "google_drive" } },
    update: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      updatedAt: new Date(),
    },
    create: {
      projectId,
      provider: "google_drive",
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    },
  });

  return data;
}

// --- Crisp ---
// Crisp plugin OAuth. Register a plugin at https://marketplace.crisp.chat/ to obtain
// CRISP_CLIENT_ID / CRISP_CLIENT_SECRET (OAuth) and CRISP_PLUGIN_ID / CRISP_PLUGIN_KEY (REST auth).
export const CRISP_AUTH_URL = "https://marketplace.crisp.chat/oauth/authorize";
export const CRISP_TOKEN_URL = "https://api.crisp.chat/v1/oauth/token";

export function getCrispAuthUrl(projectId: string) {
  const clientId = process.env.CRISP_CLIENT_ID;
  if (!clientId) throw new Error("CRISP_CLIENT_ID is missing");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${APP_URL}/api/auth/crisp/callback`,
    response_type: "code",
    state: projectId, // Pass projectId in state, mirroring Notion/Google
  });

  return `${CRISP_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCrispCode(code: string, projectId: string) {
  const clientId = process.env.CRISP_CLIENT_ID;
  const clientSecret = process.env.CRISP_CLIENT_SECRET;

  const response = await axios.post(CRISP_TOKEN_URL, {
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: `${APP_URL}/api/auth/crisp/callback`,
  });

  const data = response.data;

  // VERIFY against Crisp docs: the token response includes the granted website_id.
  // Common shapes: data.website_id, or data.websites?.[0]. We capture defensively.
  const websiteId =
    data.website_id ||
    (Array.isArray(data.websites) ? data.websites[0] : undefined) ||
    data.account_id ||
    null;

  await prisma.integration.upsert({
    where: { projectId_provider: { projectId, provider: "crisp" } },
    update: {
      accessToken: data.access_token || "",
      refreshToken: data.refresh_token || null,
      details: { website_id: websiteId },
      updatedAt: new Date(),
    },
    create: {
      projectId,
      provider: "crisp",
      accessToken: data.access_token || "",
      refreshToken: data.refresh_token || null,
      details: { website_id: websiteId },
    },
  });

  return data;
}

// --- Intercom ---
export function getIntercomAuthUrl(projectId: string): string {
  const clientId = process.env.INTERCOM_CLIENT_ID;
  if (!clientId) throw new Error("INTERCOM_CLIENT_ID is missing");

  const authUrl = new URL("https://app.intercom.com/oauth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("state", projectId);
  return authUrl.toString();
}

export async function exchangeIntercomCode(code: string, projectId: string): Promise<void> {
  const tokenRes = await fetch("https://api.intercom.io/auth/eagle/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      client_id: process.env.INTERCOM_CLIENT_ID,
      client_secret: process.env.INTERCOM_CLIENT_SECRET,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`Intercom token exchange failed: ${await tokenRes.text()}`);
  }

  const data = await tokenRes.json();
  const accessToken: string = data.token || data.access_token;

  // Fetch workspace info using the token
  const meRes = await fetch("https://api.intercom.io/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Intercom-Version": "2.10",
    },
  });
  if (!meRes.ok) {
    throw new Error(`Intercom /me request failed: ${await meRes.text()}`);
  }
  const me = await meRes.json();
  const workspaceId: string = me.app?.id_code || me.app?.id || "";

  // Fetch the first admin in the workspace and cache their bot_admin_id
  const adminsRes = await fetch("https://api.intercom.io/admins", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Intercom-Version": "2.10",
    },
  });
  let botAdminId = "";
  if (adminsRes.ok) {
    const adminsData = await adminsRes.json();
    botAdminId = adminsData.admins?.[0]?.id || adminsData.id || "";
  } else {
    console.warn(`[Intercom] Failed to fetch admins: ${await adminsRes.text()}`);
  }

  await prisma.integration.upsert({
    where: { projectId_provider: { projectId, provider: "intercom" } },
    create: {
      projectId,
      provider: "intercom",
      accessToken,
      details: { workspace_id: workspaceId, bot_admin_id: botAdminId },
    },
    update: {
      accessToken,
      details: { workspace_id: workspaceId, bot_admin_id: botAdminId },
    },
  });
}

// --- Facebook Messenger ---
const GRAPH_API = "https://graph.facebook.com/v18.0";

export function getMessengerAuthUrl(projectId: string) {
  const clientId = process.env.FACEBOOK_APP_ID;
  if (!clientId) throw new Error("FACEBOOK_APP_ID is missing");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${APP_URL}/api/auth/messenger/callback`,
    scope: "pages_messaging,pages_show_list,pages_read_engagement",
    response_type: "code",
    state: projectId, // same pattern as Notion/Google
  });

  return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
}

export async function exchangeMessengerCode(code: string, projectId: string) {
  const clientId = process.env.FACEBOOK_APP_ID;
  const clientSecret = process.env.FACEBOOK_APP_SECRET;

  // Step 1: exchange code for short-lived user access token
  const tokenRes = await axios.get(`${GRAPH_API}/oauth/access_token`, {
    params: {
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${APP_URL}/api/auth/messenger/callback`,
      code,
    },
  });
  const shortLivedToken = tokenRes.data.access_token as string;

  // Step 2: get list of pages the user manages (to find page access token + page id)
  const pagesRes = await axios.get(`${GRAPH_API}/me/accounts`, {
    params: { access_token: shortLivedToken },
  });

  // Use the first connected page — the one the user authorized
  const page = pagesRes.data.data?.[0];
  if (!page) throw new Error("No Facebook Pages found for this account.");

  const pageAccessToken = page.access_token as string;
  const pageId = page.id as string;
  const pageName = page.name as string;

  await prisma.integration.upsert({
    where: { projectId_provider: { projectId, provider: "messenger" } },
    update: {
      accessToken: pageAccessToken,
      details: { page_id: pageId, page_name: pageName },
      updatedAt: new Date(),
    },
    create: {
      projectId,
      provider: "messenger",
      accessToken: pageAccessToken,
      details: { page_id: pageId, page_name: pageName },
    },
  });

  // Step 3: subscribe the page to our app for messaging events
  await axios.post(
    `${GRAPH_API}/${pageId}/subscribed_apps`,
    null,
    {
      params: {
        subscribed_fields: "messages",
        access_token: pageAccessToken,
      },
    }
  ).catch(e => console.error("[Messenger] App subscription error:", e));

  return { pageId, pageName };
}

// --- Zoho Desk ---
export function getZohoAuthUrl(projectId: string): string {
  const clientId = process.env.ZOHO_CLIENT_ID;
  if (!clientId) throw new Error("ZOHO_CLIENT_ID is missing");
  const accountsUrl = process.env.ZOHO_ACCOUNTS_URL || "https://accounts.zoho.com";

  const url = new URL(`${accountsUrl}/oauth/v2/auth`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "Desk.tickets.CREATE,Desk.contacts.READ,Desk.contacts.CREATE,Desk.settings.READ");
  url.searchParams.set("redirect_uri", `${APP_URL}/api/auth/zoho/callback`);
  url.searchParams.set("access_type", "offline");  // get a refresh token
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", projectId);
  return url.toString();
}

export async function exchangeZohoCode(code: string, projectId: string): Promise<void> {
  const accountsUrl = process.env.ZOHO_ACCOUNTS_URL || "https://accounts.zoho.com";
  const descUrl = process.env.ZOHO_DESK_URL || "https://desk.zoho.com";

  const tokenRes = await fetch(`${accountsUrl}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.ZOHO_CLIENT_ID!,
      client_secret: process.env.ZOHO_CLIENT_SECRET!,
      redirect_uri: `${APP_URL}/api/auth/zoho/callback`,
      code,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`Zoho token exchange failed: ${await tokenRes.text()}`);
  }

  const data = await tokenRes.json();

  // Fetch the org ID — required for all Desk API calls
  const orgRes = await fetch(`${descUrl}/api/v1/organizations`, {
    headers: { Authorization: `Zoho-oauthtoken ${data.access_token}` },
  });
  if (!orgRes.ok) {
    throw new Error(`Zoho organization fetch failed: ${await orgRes.text()}`);
  }
  const orgData = await orgRes.json();
  const orgId: string = orgData.data?.[0]?.id;

  // Fetch the first department — tickets require a departmentId
  const deptRes = await fetch(`${descUrl}/api/v1/departments`, {
    headers: {
      Authorization: `Zoho-oauthtoken ${data.access_token}`,
      orgId,
    },
  });
  if (!deptRes.ok) {
    throw new Error(`Zoho departments fetch failed: ${await deptRes.text()}`);
  }
  const deptData = await deptRes.json();
  const departmentId: string = deptData.data?.[0]?.id;

  await prisma.integration.upsert({
    where: { projectId_provider: { projectId, provider: "zoho" } },
    create: {
      projectId,
      provider: "zoho",
      accessToken: data.access_token,
      refreshToken: data.refresh_token || null,
      details: { orgId, departmentId, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 },
    },
    update: {
      accessToken: data.access_token,
      ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
      details: { orgId, departmentId, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 },
    },
  });
}

// --- Dropbox ---
export function getDropboxAuthUrl(projectId: string): string {
  const clientId = process.env.DROPBOX_APP_KEY;
  if (!clientId) throw new Error("DROPBOX_APP_KEY is missing");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${APP_URL}/api/auth/dropbox/callback`,
    response_type: "code",
    token_access_type: "offline",
    state: projectId,
  });

  return `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
}

export async function exchangeDropboxCode(code: string, projectId: string): Promise<void> {
  const clientId = process.env.DROPBOX_APP_KEY;
  const clientSecret = process.env.DROPBOX_APP_SECRET;
  if (!clientId || !clientSecret) throw new Error("DROPBOX_APP_KEY / DROPBOX_APP_SECRET missing");

  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${APP_URL}/api/auth/dropbox/callback`,
    }),
  });

  if (!res.ok) throw new Error(`Dropbox token exchange failed: ${await res.text()}`);
  const data = await res.json() as any;

  await prisma.integration.upsert({
    where: { projectId_provider: { projectId, provider: "dropbox" } },
    create: {
      projectId,
      provider: "dropbox",
      accessToken: data.access_token,
      refreshToken: data.refresh_token || null,
      details: { account_id: data.account_id, uid: data.uid },
    },
    update: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || null,
      details: { account_id: data.account_id, uid: data.uid },
    },
  });
}

export async function refreshDropboxToken(projectId: string): Promise<string> {
  const integration = await prisma.integration.findUnique({
    where: { projectId_provider: { projectId, provider: "dropbox" } },
  });
  if (!integration) throw new Error("Dropbox not connected");
  if (!integration.refreshToken) return integration.accessToken;

  const clientId = process.env.DROPBOX_APP_KEY!;
  const clientSecret = process.env.DROPBOX_APP_SECRET!;
  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: integration.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) return integration.accessToken;
  const data = await res.json() as any;
  if (data.access_token) {
    await prisma.integration.update({
      where: { projectId_provider: { projectId, provider: "dropbox" } },
      data: { accessToken: data.access_token },
    });
    return data.access_token;
  }
  return integration.accessToken;
}

// --- Microsoft (OneDrive / SharePoint) ---
export function getMicrosoftAuthUrl(projectId: string): string {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  if (!clientId) throw new Error("MICROSOFT_CLIENT_ID is missing");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${APP_URL}/api/auth/microsoft/callback`,
    response_type: "code",
    scope: "https://graph.microsoft.com/Files.Read offline_access",
    state: projectId,
  });

  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function exchangeMicrosoftCode(code: string, projectId: string): Promise<void> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET missing");

  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${APP_URL}/api/auth/microsoft/callback`,
      scope: "https://graph.microsoft.com/Files.Read offline_access",
    }),
  });

  if (!res.ok) throw new Error(`Microsoft token exchange failed: ${await res.text()}`);
  const data = await res.json() as any;

  // Fetch display name from Graph
  let displayName = "OneDrive";
  try {
    const meRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    if (meRes.ok) {
      const me = await meRes.json() as any;
      displayName = me.displayName || me.userPrincipalName || "OneDrive";
    }
  } catch {}

  await prisma.integration.upsert({
    where: { projectId_provider: { projectId, provider: "microsoft" } },
    create: {
      projectId,
      provider: "microsoft",
      accessToken: data.access_token,
      refreshToken: data.refresh_token || null,
      details: { display_name: displayName },
    },
    update: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || null,
      details: { display_name: displayName },
    },
  });
}

export async function refreshMicrosoftToken(projectId: string): Promise<string> {
  const integration = await prisma.integration.findUnique({
    where: { projectId_provider: { projectId, provider: "microsoft" } },
  });
  if (!integration) throw new Error("Microsoft not connected");
  if (!integration.refreshToken) return integration.accessToken;

  const clientId = process.env.MICROSOFT_CLIENT_ID!;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET!;
  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: integration.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/Files.Read offline_access",
    }),
  });
  if (!res.ok) return integration.accessToken;
  const data = await res.json() as any;
  if (data.access_token) {
    await prisma.integration.update({
      where: { projectId_provider: { projectId, provider: "microsoft" } },
      data: { accessToken: data.access_token, ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}) },
    });
    return data.access_token;
  }
  return integration.accessToken;
}

