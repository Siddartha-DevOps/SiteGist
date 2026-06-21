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

export type YouTubeUrlType = 'video' | 'playlist' | 'channel';
export type VideoInfo = { id: string; title: string };

export function detectYouTubeUrlType(url: string): YouTubeUrlType {
  if (url.includes('/playlist?list=') || (url.includes('list=') && !url.includes('watch'))) return 'playlist';
  if (url.includes('/@') || url.includes('/c/') || (url.includes('/channel/') && !url.includes('watch'))) return 'channel';
  return 'video';
}

export function extractPlaylistId(url: string): string | null {
  const match = url.match(/[?&]list=([^&]+)/);
  return match?.[1] ?? null;
}

export function extractChannelHandle(url: string): string | null {
  // Handles /@handle, /c/name, /channel/UCxxx
  const atMatch = url.match(/\/@([^/?]+)/);
  if (atMatch) return atMatch[1];
  const cMatch = url.match(/\/c\/([^/?]+)/);
  if (cMatch) return cMatch[1];
  const idMatch = url.match(/\/channel\/(UC[^/?]+)/);
  if (idMatch) return idMatch[1];
  return null;
}

export async function getVideoTitle(videoId: string): Promise<string> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return `YouTube Video (${videoId})`;
  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`);
    if (res.ok) {
      const data = await res.json();
      const title = data?.items?.[0]?.snippet?.title;
      if (title) return title;
    }
  } catch (e) {
    console.warn("[YouTube crawler] Failed to fetch video title:", e);
  }
  return `YouTube Video (${videoId})`;
}

export async function getPlaylistVideos(
  playlistId: string,
  maxVideos = 20
): Promise<VideoInfo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("YOUTUBE_API_KEY is not set.");

  const videos: VideoInfo[] = [];
  let pageToken: string | undefined;

  const YT_API_BASE = "https://www.googleapis.com/youtube/v3";

  while (videos.length < maxVideos) {
    const params = new URLSearchParams({
      part: "snippet",
      playlistId,
      maxResults: String(Math.min(50, maxVideos - videos.length)),
      key: apiKey,
      ...(pageToken ? { pageToken } : {}),
    });

    const res = await fetch(`${YT_API_BASE}/playlistItems?${params}`);
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`YouTube API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    for (const item of data.items ?? []) {
      const id = item.snippet?.resourceId?.videoId;
      const title = item.snippet?.title || `YouTube Video (${id})`;
      if (id) {
        videos.push({ id, title });
      }
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return videos.slice(0, maxVideos);
}

export async function getChannelVideos(
  handleOrId: string,
  maxVideos = 20
): Promise<VideoInfo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("YOUTUBE_API_KEY is not set.");

  // Determine whether it's a UC... channel ID or a handle
  const isChannelId = handleOrId.startsWith("UC");
  const params = new URLSearchParams({
    part: "contentDetails",
    key: apiKey,
    ...(isChannelId ? { id: handleOrId } : { forHandle: handleOrId }),
  });

  const YT_API_BASE = "https://www.googleapis.com/youtube/v3";
  const res = await fetch(`${YT_API_BASE}/channels?${params}`);
  if (!res.ok) {
    throw new Error(`YouTube channels API error: ${res.status}`);
  }

  const data = await res.json();
  const uploadsPlaylistId: string | undefined =
    data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

  if (!uploadsPlaylistId) {
    throw new Error("Could not find uploads playlist for this channel. Custom handles might require entering the full UC... channel ID.");
  }

  return getPlaylistVideos(uploadsPlaylistId, maxVideos);
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
      let response: any;
      if (typeof (firecrawl as any).scrape === "function") {
        response = await (firecrawl as any).scrape(url, {
          formats: ["markdown"],
        });
      } else if (typeof (firecrawl as any).scrapeUrl === "function") {
        response = await (firecrawl as any).scrapeUrl(url, {
          formats: ["markdown"],
        });
      }

      if (response && response.success) {
        const doc = response.data || response;
        return {
          title: doc.metadata?.title || doc.title || url,
          content: doc.markdown || doc.content || "",
          url: doc.metadata?.sourceURL || doc.url || url,
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
      let response: any;
      if (typeof (firecrawl as any).crawl === "function") {
        response = await (firecrawl as any).crawl(url, {
          limit,
          scrapeOptions: { formats: ["markdown"] }
        });
      } else if (typeof (firecrawl as any).crawlUrl === "function") {
        response = await (firecrawl as any).crawlUrl(url, {
          limit,
          scrapeOptions: { formats: ["markdown"] }
        });
      }

      if (response && response.success) {
        const pages = response.data || response.pages || [];
        // Return array of results
        return pages.map((page: any) => ({
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

export type DocsSiteType = "gitbook" | "zendesk" | "web";

export function resolveDocsSitemapUrl(input: string): { sitemapUrl: string; type: DocsSiteType } {
  const base = input.trim().replace(/\/+$/, ""); // strip trailing slashes

  // Gitbook: hosted on gitbook.io or custom domain with gitbook pattern
  if (base.includes(".gitbook.io")) {
    return { sitemapUrl: `${base}/sitemap.xml`, type: "gitbook" };
  }

  // Zendesk Help Center: subdomain.zendesk.com/hc or custom domain with /hc path
  if (base.includes(".zendesk.com") || base.match(/\/hc($|\/)/)) {
    // Sitemap lives at /hc/sitemap.xml — strip anything after /hc
    const hcIndex = base.indexOf("/hc");
    const hcBase = hcIndex !== -1 ? base.substring(0, hcIndex + 3) : base;
    return { sitemapUrl: `${hcBase}/sitemap.xml`, type: "zendesk" };
  }

  // Generic docs site — try /sitemap.xml as the standard location
  return { sitemapUrl: `${base}/sitemap.xml`, type: "web" };
}

// ---- GitHub connector --------------------------------------------------------

/** Parse a GitHub repo from a URL (https://github.com/owner/repo) or "owner/repo". */
export function parseGithubRepo(input: string): { owner: string; repo: string } | null {
  if (!input) return null;
  const s = input.trim();
  const m = s.match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/i);
  if (m) return { owner: m[1], repo: m[2].replace(/\.git$/i, "") };
  const m2 = s.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (m2) return { owner: m2[1], repo: m2[2].replace(/\.git$/i, "") };
  return null;
}

const GITHUB_DOC_EXT = /\.(md|mdx|markdown|rst|txt)$/i;

/**
 * Discover documentation/text files in a GitHub repo via the GitHub API (one or
 * two calls: repo info for the default branch + the recursive git tree). Raw file
 * contents are fetched later, per file, during ingestion, so a big repo drains a
 * few files at a time. Set GITHUB_TOKEN to lift rate limits / read private repos.
 */
export async function getGithubDocFiles(
  owner: string,
  repo: string,
  branch?: string
): Promise<{ branch: string; files: { path: string; rawUrl: string }[] }> {
  const headers: Record<string, string> = {
    "User-Agent": "SiteGist",
    Accept: "application/vnd.github+json",
  };
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;

  let resolvedBranch = branch?.trim();
  if (!resolvedBranch) {
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (repoRes.status === 404) throw new Error(`Repo ${owner}/${repo} not found (private repos need a GITHUB_TOKEN).`);
    if (repoRes.status === 403) throw new Error("GitHub API rate limit reached — try again later or set GITHUB_TOKEN.");
    if (!repoRes.ok) throw new Error(`GitHub error (HTTP ${repoRes.status}).`);
    const info: any = await repoRes.json();
    resolvedBranch = info.default_branch || "main";
  }

  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(resolvedBranch!)}?recursive=1`,
    { headers }
  );
  if (treeRes.status === 403) throw new Error("GitHub API rate limit reached — try again later or set GITHUB_TOKEN.");
  if (!treeRes.ok) throw new Error(`Could not read repo tree (HTTP ${treeRes.status}).`);
  const tree: any = await treeRes.json();
  const items: any[] = Array.isArray(tree.tree) ? tree.tree : [];

  const files = items
    .filter((it) => it.type === "blob" && typeof it.path === "string" && GITHUB_DOC_EXT.test(it.path))
    .map((it) => ({
      path: it.path as string,
      rawUrl: `https://raw.githubusercontent.com/${owner}/${repo}/${resolvedBranch}/${(it.path as string)
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`,
    }));

  return { branch: resolvedBranch!, files };
}

export function chunkText(text: string, size = 1200, overlap = 200): string[] {
  if (!text || !text.trim()) return [];

  // Helper to split a long sentence at the nearest word boundary
  function splitLongSentence(sentence: string, maxSize: number): string[] {
    const parts: string[] = [];
    let remaining = sentence;
    while (remaining.length > maxSize) {
      let splitIdx = remaining.lastIndexOf(" ", maxSize);
      if (splitIdx === -1 || splitIdx === 0) {
        splitIdx = maxSize;
      }
      parts.push(remaining.slice(0, splitIdx));
      remaining = remaining.slice(splitIdx);
    }
    if (remaining.trim()) {
      parts.push(remaining);
    }
    return parts;
  }

  // Phase 1: Sentence splitting without using lookbehind regex for maximum compatibility.
  // Split on sentence endings preserving the punctuation/separator.
  const rawParts = text.split(/([.!?]+(?:\s+|\n+)|\n{2,})/g);
  const sentences: string[] = [];
  let currentSentence = "";

  for (let i = 0; i < rawParts.length; i++) {
    const part = rawParts[i];
    if (!part) continue;
    if (/^[.!?\s\n]+$/.test(part)) {
      currentSentence += part;
      if (currentSentence.trim()) {
        sentences.push(currentSentence);
      }
      currentSentence = "";
    } else {
      if (currentSentence.trim()) {
        sentences.push(currentSentence);
      }
      currentSentence = part;
    }
  }
  if (currentSentence.trim()) {
    sentences.push(currentSentence);
  }

  // Handle single sentences longer than size
  const processedSentences: string[] = [];
  for (const s of sentences) {
    if (s.length > size) {
      processedSentences.push(...splitLongSentence(s, size));
    } else {
      processedSentences.push(s);
    }
  }

  // Phase 2: Accumulating sentences into chunks respecting size and carrying overlap
  const chunks: string[] = [];
  let currentBuffer = "";

  for (let i = 0; i < processedSentences.length; i++) {
    const s = processedSentences[i];
    const sTrimmed = s.trim();
    if (!sTrimmed) continue;

    if (!currentBuffer) {
      currentBuffer = s;
    } else {
      if (currentBuffer.length + s.length > size) {
        chunks.push(currentBuffer.trim());

        // Seed with tail of previous buffer matching the overlap length
        let seed = "";
        if (overlap > 0 && currentBuffer.length > overlap) {
          const rawTail = currentBuffer.slice(-overlap);
          const firstSpaceIdx = rawTail.indexOf(" ");
          if (firstSpaceIdx !== -1 && firstSpaceIdx < rawTail.length - 1) {
            seed = rawTail.slice(firstSpaceIdx).trim() + " ";
          } else {
            seed = rawTail.trim() + " ";
          }
        }
        currentBuffer = seed + s;
      } else {
        currentBuffer += (currentBuffer.endsWith(" ") ? "" : " ") + s;
      }
    }
  }

  if (currentBuffer.trim()) {
    chunks.push(currentBuffer.trim());
  }

  return chunks;
}
