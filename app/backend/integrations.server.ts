import { Client } from "@notionhq/client";
import { prisma } from "~/database/db.server";
import { chunkText } from "~/ai-layer/crawler.server";
import { upsertChunks } from "~/ai-layer/ai.server";

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
    const title = page.properties.title?.title[0]?.plain_text || 
                  page.properties.Name?.title[0]?.plain_text || 
                  "Untitled Notion Page";
    
    // In a real app, you'd fetch blocks and convert to markdown
    // Here we'll simulate the content for brevity or fetch text if possible
    const content = `Notion Page: ${title}\nURL: ${page.url}\n(Imported via Notion Integration)`;

    // Save to KnowledgeSource
    await prisma.knowledgeSource.upsert({
      where: { id: `notion-${page.id}` }, // We use a predictable ID or check by source
      update: { content, title, updatedAt: new Date() },
      create: {
        id: `notion-${page.id}`,
        projectId,
        type: "web",
        source: page.url,
        title,
        content
      }
    });

    const chunks = chunkText(content);
    await upsertChunks(projectId, chunks.map(c => ({ text: c, metadata: { source: 'notion', title, url: page.url } })));
  }
}

export async function syncGoogleDrive(projectId: string) {
  // Similar logic for Google Drive
  console.log(`Syncing Google Drive for ${projectId}`);
}
