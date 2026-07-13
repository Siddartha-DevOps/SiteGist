import { Client } from "@notionhq/client";
import { prisma } from "~/database/db.server";
import { chunkText, parsePdf, parseDocx } from "~/ai-layer/crawler.server";
import { upsertChunks } from "~/ai-layer/ai.server";
import { refreshDropboxToken, refreshMicrosoftToken } from "~/backend/oauth.server";

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

// ---- Dropbox ----------------------------------------------------------------

const DROPBOX_SUPPORTED_EXT = /\.(pdf|docx|txt|md|mdx|csv)$/i;
const DROPBOX_API = "https://api.dropboxapi.com/2";
const DROPBOX_CONTENT_API = "https://content.dropboxapi.com/2";

async function listDropboxFiles(
  token: string,
  cursor?: string
): Promise<{ entries: any[]; hasMore: boolean; cursor: string }> {
  const res = cursor
    ? await fetch(`${DROPBOX_API}/files/list_folder/continue`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ cursor }),
      })
    : await fetch(`${DROPBOX_API}/files/list_folder`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ path: "", recursive: true, limit: 200 }),
      });
  if (!res.ok) throw new Error(`Dropbox list_folder error (${res.status}): ${await res.text()}`);
  const data = await res.json() as any;
  return { entries: data.entries || [], hasMore: data.has_more, cursor: data.cursor };
}

export async function syncDropbox(projectId: string) {
  const token = await refreshDropboxToken(projectId);

  // Collect all file entries recursively
  const allFiles: { path_lower: string; name: string }[] = [];
  let cursor: string | undefined;
  let hasMore = true;
  while (hasMore) {
    const result = await listDropboxFiles(token, cursor);
    for (const entry of result.entries) {
      if (entry[".tag"] === "file" && DROPBOX_SUPPORTED_EXT.test(entry.name)) {
        allFiles.push(entry);
      }
    }
    hasMore = result.hasMore;
    cursor = result.cursor;
    if (allFiles.length >= 200) break; // cap
  }

  console.log(`[Dropbox] Found ${allFiles.length} supported files for project ${projectId}`);

  for (const file of allFiles) {
    try {
      // Download file binary content
      const dlRes = await fetch(`${DROPBOX_CONTENT_API}/files/download`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Dropbox-API-Arg": JSON.stringify({ path: file.path_lower }),
          "Content-Type": "text/plain",
        },
      });
      if (!dlRes.ok) {
        console.warn(`[Dropbox] Download failed for "${file.name}" (${dlRes.status})`);
        continue;
      }

      const buffer = Buffer.from(await dlRes.arrayBuffer());
      let content = "";

      if (/\.pdf$/i.test(file.name)) {
        content = await parsePdf(buffer);
      } else if (/\.docx$/i.test(file.name)) {
        content = await parseDocx(buffer);
      } else {
        content = buffer.toString("utf-8");
      }

      if (!content.trim()) {
        console.log(`[Dropbox] Skipping empty file: "${file.name}"`);
        continue;
      }

      const title = file.name;
      const source = `dropbox:${file.path_lower}`;
      const fullContent = `Dropbox: ${title}\nPath: ${file.path_lower}\n\n${content.trim()}`.slice(0, 500_000);

      await prisma.knowledgeSource.upsert({
        where: { id: `dropbox-${Buffer.from(file.path_lower).toString("base64").slice(0, 20)}` },
        update: { content: fullContent, title, updatedAt: new Date() },
        create: {
          id: `dropbox-${Buffer.from(file.path_lower).toString("base64").slice(0, 20)}`,
          projectId,
          type: "file",
          source,
          title,
          content: fullContent,
        },
      });

      const chunks = chunkText(fullContent);
      await upsertChunks(
        projectId,
        chunks.map((c) => ({ text: c, metadata: { source, title, type: "dropbox" } }))
      );
      console.log(`[Dropbox] Synced "${title}" (${chunks.length} chunks)`);
    } catch (err) {
      console.error(`[Dropbox] Failed to process "${file.name}":`, err);
    }
  }
}

// ---- Microsoft OneDrive -----------------------------------------------------

const GRAPH_URL = "https://graph.microsoft.com/v1.0";
const ONEDRIVE_SUPPORTED_EXT = /\.(pdf|docx|txt|md|mdx|csv|pptx)$/i;

async function listOneDriveFiles(token: string): Promise<any[]> {
  const collected: any[] = [];
  // Search for supported file types using Graph search
  let url: string | null =
    `${GRAPH_URL}/me/drive/root/search(q='')?$select=id,name,file,webUrl,parentReference&$top=200`;

  while (url && collected.length < 300) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`OneDrive list error (${res.status}): ${await res.text()}`);
    const data = await res.json() as any;
    for (const item of (data.value || [])) {
      if (item.file && ONEDRIVE_SUPPORTED_EXT.test(item.name)) {
        collected.push(item);
      }
    }
    url = data["@odata.nextLink"] || null;
  }
  return collected;
}

export async function syncOneDrive(projectId: string) {
  const token = await refreshMicrosoftToken(projectId);
  const files = await listOneDriveFiles(token);
  console.log(`[OneDrive] Found ${files.length} supported files for project ${projectId}`);

  for (const file of files) {
    try {
      const dlRes = await fetch(`${GRAPH_URL}/me/drive/items/${file.id}/content`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!dlRes.ok) {
        console.warn(`[OneDrive] Download failed for "${file.name}" (${dlRes.status})`);
        continue;
      }

      const buffer = Buffer.from(await dlRes.arrayBuffer());
      let content = "";

      if (/\.pdf$/i.test(file.name)) {
        content = await parsePdf(buffer);
      } else if (/\.docx$/i.test(file.name)) {
        content = await parseDocx(buffer);
      } else {
        content = buffer.toString("utf-8");
      }

      if (!content.trim()) {
        console.log(`[OneDrive] Skipping empty file: "${file.name}"`);
        continue;
      }

      const title = file.name;
      const source = file.webUrl || `onedrive:${file.id}`;
      const fullContent = `OneDrive: ${title}\nSource: ${source}\n\n${content.trim()}`.slice(0, 500_000);

      await prisma.knowledgeSource.upsert({
        where: { id: `onedrive-${file.id}` },
        update: { content: fullContent, title, updatedAt: new Date() },
        create: {
          id: `onedrive-${file.id}`,
          projectId,
          type: "file",
          source,
          title,
          content: fullContent,
        },
      });

      const chunks = chunkText(fullContent);
      await upsertChunks(
        projectId,
        chunks.map((c) => ({ text: c, metadata: { source, title, url: source, type: "onedrive" } }))
      );
      console.log(`[OneDrive] Synced "${title}" (${chunks.length} chunks)`);
    } catch (err) {
      console.error(`[OneDrive] Failed to process "${file.name}":`, err);
    }
  }
}
