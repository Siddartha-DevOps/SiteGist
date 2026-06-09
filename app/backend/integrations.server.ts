import { Client } from "@notionhq/client";
import { prisma } from "~/database/db.server";
import { chunkText } from "~/ai-layer/crawler.server";
import { upsertChunks } from "~/ai-layer/ai.server";

async function getNotionPageContent(notion: Client, blockId: string): Promise<string> {
  try {
    let result = "";
    const blocks = await notion.blocks.children.list({ block_id: blockId });
    for (const block of blocks.results as any[]) {
      const type = block.type;
      if (block[type] && block[type].rich_text) {
        const text = block[type].rich_text.map((rt: any) => rt.plain_text).join("");
        if (text) {
          result += text + "\n\n";
        }
      }
      if (block.has_children) {
        result += await getNotionPageContent(notion, block.id);
      }
    }
    return result;
  } catch (err) {
    console.error(`Error fetching children for block ${blockId}:`, err);
    return "";
  }
}

export async function syncNotion(projectId: string) {
  const integration = await prisma.integration.findUnique({
    where: { projectId_provider: { projectId, provider: "notion" } }
  });

  if (!integration) throw new Error("Notion not connected");

  const notion = new Client({ auth: integration.accessToken });
  
  // Fetch all pages the bot has access to
  const response = await notion.search({
    filter: { property: "object", value: "page" }
  });

  for (const page of response.results as any[]) {
    const title = page.properties?.title?.title?.[0]?.plain_text || 
                  page.properties?.Name?.title?.[0]?.plain_text || 
                  "Untitled Notion Page";
    
    // Fetch actual page block children and compile to textual content
    let blockContent = "";
    try {
      blockContent = await getNotionPageContent(notion, page.id);
    } catch (e) {
      console.error(`Failed to get page content for ${page.id}:`, e);
    }

    const content = blockContent.trim() 
      ? `Notion Page: ${title}\nURL: ${page.url || ""}\n\n${blockContent}`
      : `Notion Page: ${title}\nURL: ${page.url || ""}\n(Imported via Notion Integration)`;

    // Save to KnowledgeSource
    await prisma.knowledgeSource.upsert({
      where: { id: `notion-${page.id}` }, // We use a predictable ID or check by source
      update: { content, title, updatedAt: new Date() },
      create: {
        id: `notion-${page.id}`,
        projectId,
        type: "web",
        source: page.url || `https://notion.so/${page.id.replace(/-/g, "")}`,
        title,
        content
      }
    });

    const chunks = chunkText(content);
    await upsertChunks(projectId, chunks.map(c => ({ text: c, metadata: { source: 'notion', title, url: page.url || `https://notion.so/${page.id.replace(/-/g, "")}` } })));
  }
}

const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3";

async function refreshGoogleToken(integration: { accessToken: string; refreshToken: string | null; projectId: string }): Promise<string> {
  if (!integration.refreshToken) return integration.accessToken;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: integration.refreshToken,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) return integration.accessToken;
    const data = await res.json() as any;
    if (data.access_token) {
      await prisma.integration.update({
        where: { projectId_provider: { projectId: integration.projectId, provider: "google_drive" } },
        data: { accessToken: data.access_token, updatedAt: new Date() },
      });
      return data.access_token;
    }
  } catch (err) {
    console.error("[Google Drive] Token refresh error:", err);
  }
  return integration.accessToken;
}

export async function syncGoogleDrive(projectId: string) {
  const integration = await prisma.integration.findUnique({
    where: { projectId_provider: { projectId, provider: "google_drive" } },
  });
  if (!integration) throw new Error("Google Drive not connected");

  const accessToken = await refreshGoogleToken({ ...integration, projectId });

  // List Google Docs, Sheets, and plain-text files
  const query = [
    "mimeType='application/vnd.google-apps.document'",
    "mimeType='application/vnd.google-apps.spreadsheet'",
    "mimeType='text/plain'",
    "trashed=false",
  ].join(" and trashed=false or ").replace(" and trashed=false", "") + " and trashed=false";

  const q = encodeURIComponent(
    "(mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.google-apps.spreadsheet' or mimeType='text/plain') and trashed=false"
  );

  const listRes = await fetch(
    `${GOOGLE_DRIVE_API}/files?q=${q}&fields=files(id,name,mimeType,webViewLink)&pageSize=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!listRes.ok) {
    const errText = await listRes.text();
    throw new Error(`Google Drive API list error ${listRes.status}: ${errText}`);
  }

  const { files = [] } = await listRes.json() as { files: { id: string; name: string; mimeType: string; webViewLink?: string }[] };
  console.log(`[Google Drive] Found ${files.length} files to sync for project ${projectId}`);

  for (const file of files) {
    try {
      let content = "";
      const isSheet = file.mimeType === "application/vnd.google-apps.spreadsheet";
      const isPlainText = file.mimeType === "text/plain";

      if (isPlainText) {
        const res = await fetch(
          `${GOOGLE_DRIVE_API}/files/${file.id}?alt=media`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!res.ok) { console.warn(`[Google Drive] Download failed for "${file.name}"`); continue; }
        content = await res.text();
      } else {
        const exportMime = isSheet ? "text/csv" : "text/plain";
        const res = await fetch(
          `${GOOGLE_DRIVE_API}/files/${file.id}/export?mimeType=${encodeURIComponent(exportMime)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!res.ok) { console.warn(`[Google Drive] Export failed for "${file.name}"`); continue; }
        content = await res.text();
      }

      if (!content.trim()) { console.log(`[Google Drive] Skipping empty file: "${file.name}"`); continue; }

      const title = file.name;
      const source = file.webViewLink || `https://drive.google.com/file/d/${file.id}`;
      const fullContent = `Google Drive: ${title}\nSource: ${source}\n\n${content.trim()}`;

      await prisma.knowledgeSource.upsert({
        where: { id: `gdrive-${file.id}` },
        update: { content: fullContent, title, updatedAt: new Date() },
        create: {
          id: `gdrive-${file.id}`,
          projectId,
          type: "file",
          source,
          title,
          content: fullContent,
        },
      });

      const chunks = chunkText(fullContent);
      await upsertChunks(projectId, chunks.map(c => ({
        text: c,
        metadata: { source, title, type: "google_drive" },
      })));

      console.log(`[Google Drive] Synced "${title}" (${chunks.length} chunks)`);
    } catch (err) {
      console.error(`[Google Drive] Failed to process "${file.name}":`, err);
    }
  }
}
