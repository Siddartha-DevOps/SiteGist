import { prisma } from "~/database/db.server";
import { chunkText } from "~/ai-layer/crawler.server";
import { upsertChunks, deleteSourceChunks } from "~/ai-layer/ai.server";

export async function syncShopifyProducts(
  projectId: string,
  shop: string,
  accessToken: string
): Promise<number> {
  const baseUrl = `https://${shop}.myshopify.com/admin/api/2024-01`;
  const allProducts: any[] = [];
  let pageInfo: string | null = null;

  do {
    const url: string = pageInfo
      ? `${baseUrl}/products.json?limit=250&page_info=${pageInfo}`
      : `${baseUrl}/products.json?limit=250&fields=id,title,body_html,product_type,tags,variants`;
    const res: Response = await fetch(url, {
      headers: { "X-Shopify-Access-Token": accessToken },
    });
    if (!res.ok) throw new Error(`Shopify API error: ${res.status}`);
    const data: any = await res.json();
    allProducts.push(...(data.products || []));
    const linkHeader: string = res.headers.get("Link") || "";
    const next: RegExpMatchArray | null = linkHeader.match(/<[^>]+page_info=([^&>]+)[^>]*>;\s*rel="next"/);
    pageInfo = next ? next[1] : null;
  } while (pageInfo);

  if (allProducts.length === 0) return 0;

  const lines: string[] = [];
  for (const p of allProducts) {
    const description = (p.body_html || "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 400);

    const variants = (p.variants || [])
      .map((v: any) =>
        v.title !== "Default Title" ? `${v.title}: $${v.price}` : `$${v.price}`
      )
      .join(", ");

    const parts = [
      `Product: ${p.title}`,
      p.product_type ? `Type: ${p.product_type}` : null,
      description ? `Description: ${description}` : null,
      variants ? `Pricing: ${variants}` : null,
      p.tags ? `Tags: ${p.tags}` : null,
    ].filter(Boolean) as string[];

    lines.push(parts.join("\n"));
  }

  const content = lines.join("\n\n---\n\n");
  const sourceKey = `shopify:${shop}`;

  await deleteSourceChunks(projectId, sourceKey);
  await prisma.knowledgeSource.deleteMany({ where: { projectId, source: sourceKey } });

  await prisma.knowledgeSource.create({
    data: {
      projectId,
      type: "file",
      source: sourceKey,
      title: `Shopify Products — ${shop}`,
      content,
    },
  });

  const chunks = chunkText(content);
  await upsertChunks(
    projectId,
    chunks.map((c) => ({ text: c, metadata: { title: `Shopify Products — ${shop}`, source: sourceKey } }))
  );

  return allProducts.length;
}
