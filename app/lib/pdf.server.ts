// @ts-ignore
import pdf from "pdf-parse/lib/pdf-parse.js";

/**
 * Parses PDF buffer into structured, clean Markdown-like text
 * Handles page breaks, removes running headers/footers, cleans hyphenated words, 
 * formats lists, and detects table layouts for clean vector embedding.
 */
export async function parsePdf(buffer: Buffer) {
  try {
    if (!buffer || buffer.length === 0) {
      return { text: "" };
    }

    const data = await pdf(buffer);
    let rawText = data.text || "";

    // If no text was extracted, return empty
    if (!rawText.trim()) {
      return { text: "" };
    }

    let pages = rawText.split(/\n\s*---Page Break---\s*\n/);
    if (pages.length <= 1) {
      // If pdf-parse did not insert page breaks, let's work on the full text
      pages = [rawText];
    }

    const processedPages = pages.map((pageText: string, index: number) => {
      let lines = pageText.split("\n");

      // 1. Filter out repeating running headers/footers & page numbers
      lines = lines.filter((line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return true; // keep empty lines for paragraph splits
        
        // Match standard page numbers e.g., "Page 1 of 5", "[1]", "- 1 -", "1 / 5", "1"
        if (/^(page\s+\d+(\s+of\s+\d+)?|\d+\s*\/\s*\d+|[-–—]\s*\d+\s*[-–—]|\[\d+\]|\d+)$/i.test(trimmed)) {
          return false;
        }
        return true;
      });

      // 2. Identify potential headers (e.g., short line, uppercase, or starts with section number)
      const formattedLines = lines.map((line: string, i: number) => {
        const trimmed = line.trim();
        if (!trimmed) return "";

        // Check if it's a headers line (no punctuation at end, short, capitalized or bullet/numbered)
        const isHeaderCandidate = 
          trimmed.length > 3 && 
          trimmed.length < 100 && 
          (
            /^[A-Z0-9\s\-\.\,\&\(\)\/]+$/.test(trimmed) || // fully uppercase / numbers
            /^\d+(\.\d+)*\s+[A-Z]/i.test(trimmed) || // section numbers like 1.2 Introduction
            (i === 0 && trimmed.length < 50) // first line of page if short
          ) &&
          !/[.:;?,]$/.test(trimmed); // doesn't end with standard paragraph punctuation

        if (isHeaderCandidate) {
          // If it looks like a prominent header, prefix with Markdown header
          if (/^\d+\./.test(trimmed)) {
            return `### ${trimmed}`;
          }
          return `## ${trimmed}`;
        }

        // 3. Format visual representation of standard tables/aligned columns
        // Check if line has multiple spaces separating word groups (e.g. table columns)
        if (/[A-Za-z0-9]{2,}\s{3,}[A-Za-z0-9]{2,}/.test(line)) {
          const cells = line.split(/\s{2,}/).map((cell: string) => cell.trim());
          return `| ${cells.join(" | ")} |`;
        }

        // 4. Normalize lists (bullet points, asterisks, dashes)
        if (/^[\*\-\•]\s+/.test(trimmed)) {
          return `- ${trimmed.replace(/^[\*\-\•]\s+/, "")}`;
        }

        return line;
      });

      // 5. Join lines that shouldn't be separated by absolute line breaks (broken paragraphs)
      let paragraphJoined = "";
      for (let i = 0; i < formattedLines.length; i++) {
        const currentLine = formattedLines[i];
        const nextLine = formattedLines[i + 1] || "";

        if (!currentLine.trim()) {
          paragraphJoined += "\n\n";
          continue;
        }

        const isCurrentHeader = currentLine.startsWith("#") || currentLine.startsWith("|");
        const isNextHeader = nextLine.startsWith("#") || nextLine.startsWith("|");
        const endsWithHyphen = currentLine.endsWith("-");

        if (isCurrentHeader || isNextHeader) {
          paragraphJoined += currentLine + "\n";
        } else {
          // Check if current line ends with bullet point, hyphen, or standard ending punctuation
          const isSentenceEnd = /[.!\?`"]$/.test(currentLine.trim());
          
          if (endsWithHyphen) {
            // merge hyphenated word
            paragraphJoined += currentLine.slice(0, -1);
          } else if (isSentenceEnd) {
            // starts a new paragraph or ends sentence normally
            paragraphJoined += currentLine + "\n\n";
          } else {
            // concatenate as single paragraph flowing text
            paragraphJoined += currentLine + " ";
          }
        }
      }

      return paragraphJoined;
    });

    let markdownResult = processedPages.join("\n\n---\n\n");

    // Clean up excessive spacing/newlines
    markdownResult = markdownResult
      .replace(/\n{3,}/g, "\n\n")
      .replace(/ {2,}/g, " ")
      .trim();

    return { 
      text: markdownResult,
      info: data.info,
      metadata: data.metadata,
      numpages: data.numpages
    };
  } catch (error) {
    console.error("PDF parsing error:", error);
    throw error;
  }
}

