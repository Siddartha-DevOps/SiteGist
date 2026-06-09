export function loader() {
  const txt = `User-agent: *
Allow: /

Disallow: /dashboard/
Disallow: /api/
Disallow: /embed/

Sitemap: https://sitegist.co/sitemap.xml`;

  return new Response(txt, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
