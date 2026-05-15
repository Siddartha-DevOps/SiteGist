import { type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { verifyMagicLink } from "~/backend/magic-link.server";
import { prisma } from "~/database/db.server";
import { createUserSession } from "~/backend/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return redirect("/login?error=Invalid link");
  }

  const email = await verifyMagicLink(token);

  if (!email) {
    return redirect("/login?error=Token expired or invalid");
  }

  // Find or create user
  let user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    // Note: satisfy linter while we transition
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: "", // Empty string for passwordless users
        role: "USER",
        subscriptionTier: "free"
      }
    });
  }

  return createUserSession(user.id, "/dashboard");
}
