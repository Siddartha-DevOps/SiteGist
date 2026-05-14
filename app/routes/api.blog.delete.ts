import type { ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { prisma } from "~/database/db.server";
import { requireOwner } from "~/backend/auth.server";

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireOwner(request);
  const formData = await request.formData();
  
  const intent = formData.get("intent");
  if (intent !== "delete") return json({ error: "Invalid intent" }, { status: 400 });

  const id = formData.get("id") as string;

  try {
    await prisma.blogPost.delete({
      where: { id },
    });

    return redirect("/dashboard/blog");
  } catch (error) {
    console.error("Delete Blog Error:", error);
    return json({ error: "Failed to delete blog post" }, { status: 500 });
  }
}
