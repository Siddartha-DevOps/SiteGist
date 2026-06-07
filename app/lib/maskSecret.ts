export function maskSecret(s: string | null | undefined): string {
  if (s === null || s === undefined) return "NONE";
  const str = String(s);
  if (str.length === 0) return "EMPTY";
  if (str.length <= 8) return `***(len ${str.length})`;
  return `${str.slice(0, 4)}…${str.slice(-4)} (len ${str.length})`;
}
