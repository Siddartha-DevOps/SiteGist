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
        "User-Agent": "Mozilla/5.0 (compatible; SiteGistBot/1.0)",
      },
      timeout: 10000,
    });
    const $ = cheerio.load(response.data);
    $("script, style, nav, footer, iframe, noscript").remove();
    const title = $("title").text().trim();
    const content = $("body").text().replace(/\s+/g, " ").trim();
    return { title, content, url };
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
