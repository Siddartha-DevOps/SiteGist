import type { LoaderFunctionArgs } from "@remix-run/node";

// Served at /robots.txt — allows crawling of public pages, keeps app/API/auth
// surfaces out of the index, and points crawlers at the sitemap.
export function loader({ request }: LoaderFunctionArgs) {
  const { protocol, host } = new URL(request.url);
  const origin = `${protocol}//${host}`;

  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /dashboard",
    "Disallow: /api/",
    "Disallow: /embed/",
    "Disallow: /chat/",
    "Disallow: /login",
    "Disallow: /signup",
    "Disallow: /create-chatbot",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
