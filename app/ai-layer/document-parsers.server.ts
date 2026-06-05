import Papa from "papaparse";
// @ts-ignore
import officeParser from "officeparser";

// CSV → readable sentences. Each row becomes "Col1: val1; Col2: val2; ..."
// so the embedding model sees structured, queryable context instead of raw commas.
export function parseCsv(buffer: Buffer): string {
  const text = buffer.toString("utf-8");
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  const headers = result.meta.fields ?? [];
  if (headers.length === 0) {
    // No header row detected — fall back to raw text
    return text;
  }

  const lines: string[] = [];
  for (const row of result.data) {
    const parts = headers
      .map((h) => {
        const val = (row[h] ?? "").toString().trim();
        return val ? `${h}: ${val}` : null;
      })
      .filter(Boolean);
    if (parts.length > 0) lines.push(parts.join("; "));
  }

  return lines.join("\n");
}

// PPTX → all slide text concatenated. officeparser walks the slide XML.
export async function parsePptx(buffer: Buffer): Promise<string> {
  try {
    const text = await (officeParser as any).parseOfficeAsync(buffer);
    return (text || "").trim();
  } catch (error) {
    console.error("PPTX parse error:", error);
    return "";
  }
}

// Markdown → strip syntax to plain text.
export function parseMarkdown(buffer: Buffer): string {
  let text = buffer.toString("utf-8");

  text = text
    .replace(/```[\s\S]*?```/g, " ")            // fenced code blocks
    .replace(/`([^`]+)`/g, "$1")                 // inline code
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")    // images → alt text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")     // links → link text
    .replace(/^#{1,6}\s+/gm, "")                 // headings
    .replace(/^[>\-*+]\s+/gm, "")                // blockquotes & bullets
    .replace(/(\*\*|__)(.*?)\1/g, "$2")          // bold
    .replace(/(\*|_)(.*?)\1/g, "$2")             // italic
    .replace(/^\s*\|.*\|\s*$/gm, (line) =>       // table rows → spaced cells
      line.replace(/\|/g, " ").trim()
    )
    .replace(/^[-=]{3,}\s*$/gm, "")              // horizontal rules / setext underlines
    .replace(/\n{3,}/g, "\n\n")                  // collapse blank lines
    .trim();

  return text;
}
