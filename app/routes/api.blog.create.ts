import type { ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { prisma } from "~/database/db.server";
import { requireOwner } from "~/backend/auth.server";

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireOwner(request);
  const formData = await request.formData();
  
  const title = formData.get("title") as string;
  const slug = formData.get("slug") as string;
  const excerpt = formData.get("excerpt") as string;
  const content = formData.get("content") as string;
  const coverImage = formData.get("coverImage") as string;
  const metaTitle = formData.get("metaTitle") as string;
  const seoTitle = formData.get("seoTitle") as string;
  const metaDescription = formData.get("metaDescription") as string;
  const seoDescription = formData.get("seoDescription") as string;
  const tags = formData.get("tags") as string;
  const published = formData.get("published") === "true";

  try {
    const post = await prisma.blogPost.create({
      data: {
        title,
        slug,
        excerpt,
        content,
        coverImage,
        metaTitle,
        seoTitle,
        metaDescription,
        seoDescription,
        tags,
        published,
        authorId: user.id,
      },
    });

    return redirect("/dashboard/blog");
  } catch (error) {
    console.error("Create Blog Error:", error);
    return json({ error: "Failed to create blog post" }, { status: 500 });
  }
}
