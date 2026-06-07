const GREETINGS = ["hi","hello","hey","hola","greetings","hi there","hello there","yo","good morning","good afternoon","good evening"];

export function isPlainGreeting(query: string): boolean {
  if (!query) return false;
  const normalized = query.toLowerCase().trim().replace(/[?!.]+$/, "");
  if (!normalized) return false;
  if (GREETINGS.includes(normalized)) return true;
  return /^(hi|hello|hey)\b/i.test(normalized) && normalized.length < 12;
}
