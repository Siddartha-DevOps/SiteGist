import { prisma } from "~/database/db.server";
import { chunkText } from "~/ai-layer/crawler.server";
import { upsertChunks, deleteSourceChunks } from "~/ai-layer/ai.server";

function extractText(node: any): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (node.text !== undefined) return String(node.text);
  const children = node.nodes || node.children || node.leaves || [];
  return children.map(extractText).join(" ").replace(/\s+/g, " ").trim();
}

async function fetchPageContent(
  spaceId: string,
  pageId: string,
  headers: Record<string, string>
): Promise<string> {
  const res = await fetch(
    `https://api.gitbook.com/v1/spaces/${spaceId}/content/page/${pageId}`,
    { headers }
  );
  if (!res.ok) return "";
  const data = await res.json();
  return extractText(data.document || data).slice(0, 15000);
}

function collectPages(items: any[]): { id: string; title: string; url: string }[] {
  const pages: { id: string; title: string; url: string }[] = [];
  for (const item of items || []) {
    if (item.type === "document" && item.id) {
      pages.push({
        id: item.id,
        title: item.title || "Untitled",
        url: item.urls?.published || item.urls?.app || "",
      });
    }
    if (item.pages) pages.push(...collectPages(item.pages));
  }
  return pages;
}

export async function syncGitbookSpace(
  projectId: string,
  apiToken: string,
  spaceId: string
): Promise<number> {
  const headers = { Authorization: `Bearer ${apiToken}` };

  const contentRes = await fetch(
    `https://api.gitbook.com/v1/spaces/${spaceId}/content`,
    { headers }
  );
  if (!contentRes.ok)
    throw new Error(`GitBook API error: ${contentRes.status} ${await contentRes.text()}`);

  const contentData = await contentRes.json();
  const pages = collectPages(contentData.pages || []).slice(0, 100);

  if (pages.length === 0) return 0;

  let synced = 0;
  for (const page of pages) {
    try {
      const text = await fetchPageContent(spaceId, page.id, headers);
      if (!text.trim()) continue;

      const sourceKey = `gitbook:${spaceId}:${page.id}`;
      await deleteSourceChunks(projectId, sourceKey);
      await prisma.knowledgeSource.deleteMany({ where: { projectId, source: sourceKey } });

      await prisma.knowledgeSource.create({
        data: {
          projectId,
          type: "web",
          source: sourceKey,
          title: page.title,
          content: text,
        },
      });

      const chunks = chunkText(text);
      await upsertChunks(
        projectId,
        chunks.map((c) => ({
          text: c,
          metadata: { title: page.title, source: page.url || sourceKey },
        }))
      );

      synced++;
    } catch (err) {
      console.error(`[GitBook] Failed to sync page ${page.id}:`, err);
    }
  }

  return synced;
}
