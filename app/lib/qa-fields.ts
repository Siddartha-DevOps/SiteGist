/** Pure Q&A field validation (shared by promote helpers + unit tests). */

export function validateQaFields(question: string, answer: string): string | null {
  const q = question.trim();
  const a = answer.trim();
  if (!q || !a) return "Both question and answer are required.";
  if (q.length > 500) return "Question cannot exceed 500 characters.";
  if (a.length > 5000) return "Answer cannot exceed 5000 characters.";
  return null;
}
