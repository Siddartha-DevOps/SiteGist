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
