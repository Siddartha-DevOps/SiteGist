import type { LoaderFunctionArgs } from "@remix-run/node";
import { prisma } from "~/database/db.server";

// Public, indexable marketing/content pages. Dynamic segments, the dashboard,
// the embed widget, and auth pages are intentionally excluded.
const STATIC_PATHS = [
  "/",
  "/features",
  "/pricing",
  "/integrations",
  "/security",
  "/lead-generation",
  "/wordpress-plugin",
  "/contact-us",
  "/docs",
  "/docs/api-reference",
  "/docs/changelog",
  "/tools",
  "/tools/convert-pdf-to-markdown",
  "/tools/generator-reply",
  "/blog",
  "/privacy",
  "/terms",
  "/refund",
  "/TrustCenter",
];

function xmlEscape(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string)
  );
}

// Served at /sitemap.xml — static pages plus every published blog post so search
// engines discover and index the articles.
export async function loader({ request }: LoaderFunctionArgs) {
  const { protocol, host } = new URL(request.url);
  const origin = `${protocol}//${host}`;

  let posts: { slug: string; updatedAt: Date }[] = [];
  try {
    posts = await prisma.blogPost.findMany({
      where: { published: true },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });
  } catch (error) {
    // If the DB is unavailable, still emit a valid static sitemap.
    console.error("[sitemap] blog fetch failed:", error);
  }

  const entries = [
    ...STATIC_PATHS.map((p) => ({
      loc: `${origin}${p}`,
      lastmod: undefined as string | undefined,
      priority: p === "/" ? "1.0" : "0.7",
    })),
    ...posts.map((p) => ({
      loc: `${origin}/blog/${p.slug}`,
      lastmod: p.updatedAt.toISOString(),
      priority: "0.6",
    })),
  ];

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries
      .map(
        (e) =>
          `  <url>\n` +
          `    <loc>${xmlEscape(e.loc)}</loc>\n` +
          (e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>\n` : "") +
          `    <priority>${e.priority}</priority>\n` +
          `  </url>`
      )
      .join("\n") +
    `\n</urlset>\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
