import FirecrawlApp from "@mendable/firecrawl-js";

/**
 * Firecrawl is used for fast, LLM-ready web scraping and crawling.
 */
let _firecrawl: FirecrawlApp | null = null;

export function getFirecrawl() {
  if (!_firecrawl) {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      console.warn("FIRECRAWL_API_KEY is not defined.");
      return null;
    }
    _firecrawl = new FirecrawlApp({ apiKey });
  }
  return _firecrawl;
}

export async function scrapeUrl(url: string) {
  const app = getFirecrawl();
  if (!app) {
    throw new Error("Firecrawl not configured");
  }

  const scrapeResponse = await (app as any).scrapeUrl(url, {
    formats: ["markdown", "html"],
  });

  if (!scrapeResponse.success) {
    throw new Error(`Failed to scrape: ${scrapeResponse.error}`);
  }

  return scrapeResponse.data;
}

export async function crawlUrl(url: string) {
  const app = getFirecrawl();
  if (!app) {
    throw new Error("Firecrawl not configured");
  }

  const crawlResponse = await (app as any).crawlUrl(url, {
    limit: 10,
    scrapeOptions: {
      formats: ["markdown"],
    }
  });

  if (!crawlResponse.success) {
    throw new Error(`Failed to crawl: ${crawlResponse.error}`);
  }

  return crawlResponse;
}
