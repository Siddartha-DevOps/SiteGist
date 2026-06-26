import { serve } from "@upstash/workflow/react-router";
import { prisma } from "~/database/db.server";
import { crawlUrl, chunkText } from "~/ai-layer/crawler.server";
import { upsertChunks } from "~/ai-layer/ai.server";

export const action = serve(async (context: any) => {
  const { projectId } = context.requestPayload as { projectId: string };

  const project = await context.run("fetch-project", async () => {
    return await prisma.project.findUnique({
      where: { id: projectId },
      include: { knowledgeSources: true }
    });
  });

  if (!project) return;

  const webSources = project.knowledgeSources.filter((s: any) => s.type === "web");

  for (const source of webSources) {
    await context.run(`recrawl-${source.id}`, async () => {
      // crawlUrl can throw for robots-blocked / oversized / JS-only pages — skip
      // those sources instead of failing the whole recrawl batch.
      let data: Awaited<ReturnType<typeof crawlUrl>> = null;
      try {
        data = await crawlUrl(source.source);
      } catch (err) {
        console.warn(`[Recrawl] Skipping ${source.source}:`, err);
        return;
      }
      if (data && data.content) {
        const chunks = chunkText(data.content);
        await upsertChunks(projectId, chunks.map(c => ({ 
          text: c, 
          metadata: { source: source.source, title: data.title, type: "web" } 
        })));
        
        await prisma.knowledgeSource.update({
          where: { id: source.id },
          data: { updatedAt: new Date(), title: data.title }
        });
      }
    });
  }
});
