import type { LoaderFunctionArgs } from "@remix-run/node";
import { prisma } from "~/database/db.server";

const BASE_URL = "https://sitegist.co";

const staticPages = [
  { url: "/",                 priority: "1.0", changefreq: "weekly"  },
  { url: "/features",         priority: "0.9", changefreq: "weekly"  },
  { url: "/pricing",          priority: "0.9", changefreq: "weekly"  },
  { url: "/integrations",     priority: "0.8", changefreq: "monthly" },
  { url: "/blog",             priority: "0.8", changefreq: "daily"   },
  { url: "/lead-generation",  priority: "0.7", changefreq: "monthly" },
  { url: "/wordpress-plugin", priority: "0.7", changefreq: "monthly" },
  { url: "/security",         priority: "0.5", changefreq: "monthly" },
  { url: "/privacy",          priority: "0.3", changefreq: "monthly" },
  { url: "/terms",            priority: "0.3", changefreq: "monthly" },
];

export async function loader(_: LoaderFunctionArgs) {
  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  const now = new Date().toISOString().split("T")[0];

  const urlNodes = [
    ...staticPages.map(
      (p) =>
        `<url><loc>${BASE_URL}${p.url}</loc><lastmod>${now}</lastmod><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`
    ),
    ...posts.map(
      (p) =>
        `<url><loc>${BASE_URL}/blog/${p.slug}</loc><lastmod>${p.updatedAt.toISOString().split("T")[0]}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`
    ),
  ].join("\n  ");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urlNodes}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
