import { prisma } from "~/database/db.server";

/**
 * Record a question the bot could not answer from its knowledge base.
 * Fire-and-forget; dedupes identical questions per project within 24h.
 */
export function recordUnansweredQuestion(projectId: string, question: string): void {
  const normalized = question?.trim();
  if (!normalized || projectId === "demo-project") return;

  void (async () => {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const existing = await prisma.unansweredQuestion.findFirst({
        where: { projectId, question: normalized, createdAt: { gte: since } },
        select: { id: true },
      });
      if (existing) return;
      await prisma.unansweredQuestion.create({
        data: { projectId, question: normalized },
      });
    } catch (err) {
      console.warn("[UnansweredQuestion] Failed to record:", err);
    }
  })();
}
