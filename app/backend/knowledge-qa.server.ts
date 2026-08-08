/**
 * Promote visitor questions into KnowledgeQA overrides (exact-match answers).
 * Used by Insights / overview "Add as Q&A" flows.
 */

import { prisma } from "~/database/db.server";
import { validateQaFields } from "~/lib/qa-fields";

export type PromoteQaInput = {
  projectId: string;
  question: string;
  answer: string;
};

export type PromoteQaResult =
  | { ok: true; qaId: string; created: boolean }
  | { ok: false; error: string; status: number };

export { validateQaFields };

/**
 * Create a KnowledgeQA row (or return the existing id if the same question
 * already exists for this project). Case-insensitive question match.
 */
export async function createOrGetKnowledgeQA(input: PromoteQaInput): Promise<PromoteQaResult> {
  const question = input.question.trim();
  const answer = input.answer.trim();
  const err = validateQaFields(question, answer);
  if (err) return { ok: false, error: err, status: 400 };

  const existing = await prisma.knowledgeQA.findFirst({
    where: {
      projectId: input.projectId,
      question: { equals: question, mode: "insensitive" },
    },
    select: { id: true },
  });

  if (existing) {
    // Update the answer so promoting again can fix a bad draft.
    await prisma.knowledgeQA.update({
      where: { id: existing.id },
      data: { answer },
    });
    return { ok: true, qaId: existing.id, created: false };
  }

  const created = await prisma.knowledgeQA.create({
    data: {
      projectId: input.projectId,
      question,
      answer,
      triggerCount: 0,
    },
    select: { id: true },
  });

  return { ok: true, qaId: created.id, created: true };
}

/** Remove unanswered rows that match this question (case-insensitive). */
export async function clearUnansweredForQuestion(projectId: string, question: string): Promise<number> {
  const normalized = question.trim();
  if (!normalized) return 0;
  // Prisma deleteMany doesn't support mode:"insensitive" on all providers equally;
  // fetch matching ids then delete — unanswered volume is small.
  const rows = await prisma.unansweredQuestion.findMany({
    where: { projectId },
    select: { id: true, question: true },
  });
  const ids = rows
    .filter((r) => r.question.trim().toLowerCase() === normalized.toLowerCase())
    .map((r) => r.id);
  if (ids.length === 0) return 0;
  const res = await prisma.unansweredQuestion.deleteMany({ where: { id: { in: ids } } });
  return res.count;
}

/**
 * Find the user question that preceded an assistant message (for thumbs-down → Q&A).
 */
export async function findPrecedingUserQuestion(
  sessionId: string,
  assistantCreatedAt: Date
): Promise<string | null> {
  const prior = await prisma.message.findFirst({
    where: {
      sessionId,
      role: "user",
      createdAt: { lt: assistantCreatedAt },
    },
    orderBy: { createdAt: "desc" },
    select: { content: true },
  });
  const q = prior?.content?.trim();
  return q || null;
}
