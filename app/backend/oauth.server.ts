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


