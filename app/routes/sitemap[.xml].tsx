import type { LoaderFunctionArgs } from "@remix-run/node";
import { prisma } from "~/database/db.server";

const STATIC_ROUTES: Array<{ path: string; priority: string; changefreq: string }> = [
  { path: "/",                          priority: "1.0", changefreq: "weekly"  },
  { path: "/pricing",                   priority: "0.9", changefreq: "weekly"  },
  { path: "/features",                  priority: "0.9", changefreq: "monthly" },
  { path: "/integrations",              priority: "0.8", changefreq: "monthly" },
  { path: "/blog",                      priority: "0.8", changefreq: "daily"   },
  { path: "/docs",                      priority: "0.7", changefreq: "weekly"  },
  { path: "/docs/changelog",            priority: "0.6", changefreq: "weekly"  },
  { path: "/create-chatbot",            priority: "0.8", changefreq: "monthly" },
  { path: "/lead-generation",           priority: "0.7", changefreq: "monthly" },
  { path: "/wordpress-plugin",          priority: "0.6", changefreq: "monthly" },
  { path: "/tools",                     priority: "0.7", changefreq: "monthly" },
  { path: "/tools/convert-pdf-to-markdown", priority: "0.6", changefreq: "monthly" },
  { path: "/tools/generator-reply",     priority: "0.6", changefreq: "monthly" },
  { path: "/contact-us",               priority: "0.5", changefreq: "yearly"  },
  { path: "/security",                  priority: "0.5", changefreq: "yearly"  },
  { path: "/privacy",                   priority: "0.4", changefreq: "yearly"  },
  { path: "/terms",                     priority: "0.4", changefreq: "yearly"  },
  { path: "/refund",                    priority: "0.4", changefreq: "yearly"  },
];

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toW3CDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const origin = new URL(request.url).origin;

  // Fetch only the fields needed for the sitemap
  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  const now = toW3CDate(new Date());

  const staticEntries = STATIC_ROUTES.map(
    (r) => `
  <url>
    <loc>${escapeXml(origin + r.path)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`
  ).join("");

  const blogEntries = posts
    .map(
      (post) => `
  <url>
    <loc>${escapeXml(origin + "/blog/" + post.slug)}</loc>
    <lastmod>${toW3CDate(post.updatedAt)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticEntries}
${blogEntries}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "X-Robots-Tag": "noindex", // the sitemap itself shouldn't be indexed
    },
  });
}
