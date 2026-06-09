import type { LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  const origin = new URL(request.url).origin;

  const content = [
    "User-agent: *",
    "Allow: /",
    "",
    // Keep private areas out of Google's index
    "Disallow: /dashboard/",
    "Disallow: /api/",
    "Disallow: /embed/",
    "Disallow: /chat/",
    "Disallow: /logout",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
  ].join("\n");

  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
