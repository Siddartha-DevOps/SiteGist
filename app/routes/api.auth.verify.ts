import { type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { verifyMagicLink } from "~/backend/magic-link.server";
import { prisma } from "~/database/db.server";
import { createUserSession } from "~/backend/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (!token) {
      console.warn("[Auth Verify] No token found in URL");
      return redirect("/login?error=Invalid link");
    }

    const email = await verifyMagicLink(token);

    if (!email) {
      console.warn("[Auth Verify] Magic link verification failed (expired or invalid token)");
      return redirect("/login?error=Token expired or invalid");
    }

    console.log(`[Auth Verify] Verified email: ${email}. Attempting DB lookup...`);

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      console.log(`[Auth Verify] New user detected. Creating account for ${email}...`);
      user = await prisma.user.create({
        data: {
          email,
          passwordHash: "", // Empty string for passwordless users
          role: "USER",
          subscriptionTier: "free"
        }
      });
    }

    console.log(`[Auth Verify] Success! Creating session for user ID: ${user.id}`);
    return createUserSession(user.id, "/dashboard");
  } catch (error: any) {
    console.error("--------------------------------------------------");
    console.error("[Auth Verify] CRITICAL ERROR DURING LOGIN:");
    console.error("Message:", error.message);
    console.error("Stack:", error.stack);
    
    if (error.message.includes("Can't reach database")) {
      console.error("HINT: Database connection failed. Is your DATABASE_URL correct?");
    }
    
    if (error.message.includes("SESSION_SECRET")) {
      console.error("HINT: SESSION_SECRET is missing or invalid.");
    }
    console.error("--------------------------------------------------");
    
    // Check if it's a Prisma error or connection error
    const errorMessage = error.message?.toLowerCase();
    if (errorMessage.includes("database") || errorMessage.includes("prisma")) {
      return redirect("/login?error=Database connection error. Check environment variables.");
    }

    throw error; // Let the root error handler catch it if it's something else
  }
}
