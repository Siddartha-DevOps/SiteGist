import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "~/database/db.server";
import { requireOwner } from "~/backend/auth.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireOwner(request);
  const post = await prisma.blogPost.findUnique({
    where: { slug: params.slug },
    include: { author: true }
  });
  if (!post) return json({ error: "Post not found" }, { status: 404 });
  return json(post);
}
