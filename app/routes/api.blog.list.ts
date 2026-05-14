import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "~/database/db.server";
import { requireOwner } from "~/backend/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireOwner(request);
  try {
    const posts = await prisma.blogPost.findMany({
      orderBy: { createdAt: "desc" },
      include: { author: true }
    });
    return json(posts);
  } catch (error: any) {
    console.error("[API Blog List] Database error:", error.message);
    return json({ error: error.message }, { status: 500 });
  }
}
