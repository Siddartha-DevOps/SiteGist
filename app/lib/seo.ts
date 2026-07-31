import type { MetaDescriptor } from "@remix-run/node";

/**
 * Standard page meta (title, description, Open Graph, Twitter card) for link
 * previews. In Remix v2 a route's meta replaces the root's, so each page that
 * wants a specific preview calls this; routes without their own meta fall back
 * to the root default.
 */
export function pageMeta(opts: { title: string; description: string; image?: string }): MetaDescriptor[] {
  const title = opts.title.includes("SiteGist") ? opts.title : `${opts.title} | SiteGist`;
  const tags: MetaDescriptor[] = [
    { title },
    { name: "description", content: opts.description },
    { property: "og:site_name", content: "SiteGist" },
    { property: "og:type", content: "website" },
    { property: "og:title", content: title },
    { property: "og:description", content: opts.description },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: opts.description },
  ];
  if (opts.image) {
    tags.push({ property: "og:image", content: opts.image });
    tags.push({ name: "twitter:image", content: opts.image });
  }
  return tags;
}
