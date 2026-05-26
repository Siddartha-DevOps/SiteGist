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

export async function syncGoogleDrive(projectId: string) {
  // Similar logic for Google Drive
  console.log(`Syncing Google Drive for ${projectId}`);
}
