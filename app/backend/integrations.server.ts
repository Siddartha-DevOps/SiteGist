import { Client } from "@notionhq/client";
import { prisma } from "~/database/db.server";
import { chunkText } from "~/ai-layer/crawler.server";
import { upsertChunks } from "~/ai-layer/ai.server";
import { enqueueManySourceIngestions } from "~/ai-layer/ingestion.server";

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
    await upsertChunks(
      projectId,
      chunks.map(c => ({ text: c, metadata: { source: 'notion', title, url: page.url || `https://notion.so/${page.id.replace(/-/g, "")}` } })),
      { sourceId: `notion-${page.id}` }
    );
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
      await upsertChunks(
        projectId,
        chunks.map(c => ({ text: c, metadata: { source, title, type: "google_drive" } })),
        { sourceId: `gdrive-${file.id}` }
      );

      console.log(`[Google Drive] Synced "${title}" (${chunks.length} chunks)`);
    } catch (err) {
      console.error(`[Google Drive] Failed to process "${file.name}":`, err);
    }
  }
}

// --- Confluence (Atlassian) ---

/** Strip Confluence storage-format XHTML down to readable plain text. */
function stripHtml(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|table)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

/**
 * Atlassian access tokens are short-lived (~1h). Proactively refresh before a
 * sync using the stored refresh token (mirrors refreshGoogleToken). Atlassian
 * rotates refresh tokens, so persist the new one when returned.
 */
async function refreshConfluenceToken(integration: {
  accessToken: string;
  refreshToken: string | null;
  projectId: string;
}): Promise<string> {
  if (!integration.refreshToken) return integration.accessToken;
  try {
    const res = await fetch("https://auth.atlassian.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: process.env.CONFLUENCE_CLIENT_ID,
        client_secret: process.env.CONFLUENCE_CLIENT_SECRET,
        refresh_token: integration.refreshToken,
      }),
    });
    if (!res.ok) return integration.accessToken;
    const data = (await res.json()) as any;
    if (data.access_token) {
      await prisma.integration.update({
        where: { projectId_provider: { projectId: integration.projectId, provider: "confluence" } },
        data: {
          accessToken: data.access_token,
          ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
          updatedAt: new Date(),
        },
      });
      return data.access_token;
    }
  } catch (err) {
    console.error("[Confluence] Token refresh error:", err);
  }
  return integration.accessToken;
}

/**
 * Import every Confluence page across the connected workspace's spaces as a
 * KnowledgeSource (type "text"), then hand them to the ingestion pipeline.
 * Capped to keep a single request bounded; the queued sources finish via the
 * background drain.
 */
export async function syncConfluence(projectId: string) {
  const integration = await prisma.integration.findUnique({
    where: { projectId_provider: { projectId, provider: "confluence" } },
  });
  if (!integration) throw new Error("Confluence not connected");

  const cloudId = (integration.details as any)?.cloud_id;
  if (!cloudId) throw new Error("Confluence cloud ID is missing — please reconnect Confluence.");
  const siteUrl = (integration.details as any)?.site_url || "";

  const accessToken = await refreshConfluenceToken({ ...integration, projectId });
  const base = `https://api.atlassian.com/ex/confluence/${cloudId}/wiki/rest/api`;
  const authHeaders = { Authorization: `Bearer ${accessToken}`, Accept: "application/json" };

  const MAX_SPACES = 50;
  const PAGES_PER_SPACE = 100;
  const MAX_TOTAL_PAGES = 200;

  // 1. Fetch all spaces.
  const spacesRes = await fetch(`${base}/space?limit=${MAX_SPACES}`, { headers: authHeaders });
  if (!spacesRes.ok) {
    throw new Error(`Confluence space list failed (HTTP ${spacesRes.status}): ${await spacesRes.text()}`);
  }
  const spacesData = (await spacesRes.json()) as any;
  const spaces: any[] = spacesData.results || [];

  const toEnqueue: { projectId: string; sourceId: string }[] = [];
  let pageCount = 0;

  // 2. For each space, fetch its pages with body.storage expanded.
  for (const space of spaces) {
    if (pageCount >= MAX_TOTAL_PAGES) break;
    const spaceKey = space.key;
    if (!spaceKey) continue;

    const pagesRes = await fetch(
      `${base}/content?type=page&spaceKey=${encodeURIComponent(spaceKey)}&expand=body.storage&limit=${PAGES_PER_SPACE}`,
      { headers: authHeaders }
    );
    if (!pagesRes.ok) {
      console.error(`[Confluence] Page list failed for space ${spaceKey}: HTTP ${pagesRes.status}`);
      continue;
    }
    const pagesData = (await pagesRes.json()) as any;
    const pages: any[] = pagesData.results || [];

    for (const page of pages) {
      if (pageCount >= MAX_TOTAL_PAGES) break;

      // 3. Extract plain text from the storage-format body.
      const text = stripHtml(page.body?.storage?.value || "");
      if (!text.trim()) continue;

      const title = page.title || "Confluence Page";
      const webUrl = page._links?.webui ? `${siteUrl}/wiki${page._links.webui}` : "";
      const sourceKey = `confluence-${page.id}`;
      const content = `Confluence Page: ${title}\n${webUrl ? `URL: ${webUrl}\n` : ""}\n${text}`;

      // 4. Create (or refresh) a text KnowledgeSource per page.
      const existing = await prisma.knowledgeSource.findFirst({
        where: { projectId, source: sourceKey },
      });
      const src = existing
        ? await prisma.knowledgeSource.update({
            where: { id: existing.id },
            data: { content, title, status: "queued", error: null },
          })
        : await prisma.knowledgeSource.create({
            data: { projectId, type: "text", source: sourceKey, title, content, status: "queued" },
          });
      toEnqueue.push({ projectId, sourceId: src.id });
      pageCount++;
    }
  }

  // 5. Enqueue everything for ingestion (a few inline for instant feedback).
  await enqueueManySourceIngestions(toEnqueue, { maxInline: 5 });

  return { spaces: spaces.length, pages: toEnqueue.length };
}
