import axios from "axios";
import * as cheerio from "cheerio";
import Sitemapper from "sitemapper";
import mammoth from "mammoth";
import { getFirecrawl } from "./firecrawl.server";
import { parsePdf as parsePdfUtil } from "~/lib/pdf.server";
import { YoutubeTranscript } from "youtube-transcript";

export async function getYoutubeTranscript(url: string) {
  try {
    const videoIdMatch = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([^& \n]+)/);
    const videoId = videoIdMatch ? videoIdMatch[1] : url;
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    return transcript.map(t => t.text).join(" ");
  } catch (error) {
    console.error("YouTube transcript error:", error);
    return "";
  }
}

export async function parsePdf(buffer: Buffer) {
  try {
    return await parsePdfUtil(buffer).then(data => data.text);
  } catch (error) {
    console.error("PDF parse error:", error);
    return "";
  }
}

export async function parseDocx(buffer: Buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error("Docx parse error:", error);
    return "";
  }
}

export async function crawlUrl(url: string, recursive = false) {
  const firecrawl = getFirecrawl();
  
  if (firecrawl && !recursive) {
    try {
      const response = await (firecrawl as any).scrapeUrl(url, {
        formats: ["markdown"],
      });
      if (response.success) {
        return {
          title: response.data.metadata?.title || url,
          content: response.data.markdown,
          url: response.data.metadata?.sourceURL || url,
        };
      }
    } catch (e) {
      console.warn("Firecrawl failed, falling back to basic crawler", e);
    }
  }

  // Fallback to basic axios/cheerio if firecrawl fails or is missing
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SiteGistBot/1.0; +https://sitegist.ai)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      timeout: 15000,
    });
    const $ = cheerio.load(response.data);
    
    // Clean up unnecessary, non-content tags
    $("script, style, nav, footer, header, iframe, noscript, svg, .cookie-banner, #cookie-consent, .pop-up, .menu, .sidebar, [aria-hidden='true']").remove();
    
    const title = $("title").text().trim() || $("h1").first().text().trim() || url;
    
    // Advanced HTML-to-Markdown parser built directly on cheerio
    let markdown = "";
    
    // Help helper function to traverse and extract markdown
    function extractNode(element: any) {
      $(element).children().each((_, el) => {
        const tagName = el.tagName ? el.tagName.toLowerCase() : "";
        
        switch (tagName) {
          case "h1":
            markdown += `\n\n# ${$(el).text().trim().replace(/\s+/g, " ")}\n\n`;
            break;
          case "h2":
            markdown += `\n\n## ${$(el).text().trim().replace(/\s+/g, " ")}\n\n`;
            break;
          case "h3":
            markdown += `\n\n### ${$(el).text().trim().replace(/\s+/g, " ")}\n\n`;
            break;
          case "h4":
          case "h5":
          case "h6":
            markdown += `\n\n#### ${$(el).text().trim().replace(/\s+/g, " ")}\n\n`;
            break;
          case "p": {
            const text = $(el).text().trim().replace(/\s+/g, " ");
            if (text) markdown += `\n\n${text}\n\n`;
            break;
          }
          case "li": {
            const text = $(el).text().trim().replace(/\s+/g, " ");
            if (text) markdown += `\n- ${text}`;
            break;
          }
          case "ul":
          case "ol":
            markdown += "\n";
            extractNode(el);
            markdown += "\n";
            break;
          case "pre":
          case "code": {
            const codeText = $(el).text().trim();
            if (codeText) markdown += `\n\`\`\`\n${codeText}\n\`\`\`\n`;
            break;
          }
          case "table": {
            markdown += "\n\n";
            const rows: string[][] = [];
            $(el).find("tr").each((_, tr) => {
              const row: string[] = [];
              $(tr).find("th, td").each((_, td) => {
                row.push($(td).text().trim().replace(/\s+/g, " ").replace(/\|/g, "\\|"));
              });
              if (row.length > 0) rows.push(row);
            });
            
            if (rows.length > 0) {
              // Add header
              markdown += `| ${rows[0].join(" | ")} |\n`;
              markdown += `| ${rows[0].map(() => "---").join(" | ")} |\n`;
              // Add body
              for (let i = 1; i < rows.length; i++) {
                markdown += `| ${rows[i].join(" | ")} |\n`;
              }
            }
            markdown += "\n";
            break;
          }
          case "blockquote": {
            const quote = $(el).text().trim().replace(/\s+/g, " ");
            if (quote) markdown += `\n\n> ${quote}\n\n`;
            break;
          }
          case "div":
          case "section":
          case "article":
          case "main": {
            // Traverse child elements
            extractNode(el);
            break;
          }
          default: {
            // For simple inline text or text nodes
            const text = $(el).text().trim().replace(/\s+/g, " ");
            if (text && $(el).children().length === 0) {
              markdown += ` ${text} `;
            } else {
              extractNode(el);
            }
          }
        }
      });
    }

    const bodyElement = $("body");
    if (bodyElement.length > 0) {
      extractNode(bodyElement);
    } else {
      markdown = $.text();
    }

    // Clean up excessive formatting artifacts
    const cleanedContent = markdown
      .replace(/\n{3,}/g, "\n\n")
      .replace(/ +/g, " ")
      .trim();

    return { 
      title, 
      content: cleanedContent || $.text().replace(/\s+/g, " ").trim(), 
      url 
    };
  } catch (error) {
    console.error(`Error crawling ${url}:`, error);
    return null;
  }
}

export async function crawlRecursive(url: string, limit = 10) {
  const firecrawl = getFirecrawl();
  if (firecrawl) {
    try {
      const response = await (firecrawl as any).crawlUrl(url, {
        limit,
        scrapeOptions: { formats: ["markdown"] }
      });
      if (response.success) {
        // Return array of results
        return response.data.map((page: any) => ({
          title: page.metadata?.title || page.url,
          content: page.markdown || page.html,
          url: page.url
        }));
      }
    } catch (e) {
      console.error("Recursive crawl failed:", e);
    }
  }
  return [];
}

export async function getSitemapUrls(url: string) {
  const sitemap = new Sitemapper({
    url,
    timeout: 15000,
  });
  
  try {
    const { sites } = await sitemap.fetch();
    return sites;
  } catch (error) {
    console.error("Sitemap error:", error);
    return [];
  }
}

export function chunkText(text: string, size = 1000, overlap = 200) {
  const chunks = [];
  for (let i = 0; i < text.length; i += size - overlap) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}
