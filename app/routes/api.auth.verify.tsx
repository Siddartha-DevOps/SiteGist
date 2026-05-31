import { type LoaderFunctionArgs, type ActionFunctionArgs, redirect, json } from "@remix-run/node";
import { useLoaderData, Form, useNavigation } from "@remix-run/react";
import { verifyMagicLink, checkMagicLinkWithoutConsuming } from "~/backend/magic-link.server";
import { prisma } from "~/database/db.server";
import { createUserSession } from "~/backend/auth.server";
import { ShieldCheck, ArrowRight, Loader2 } from "lucide-react";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    console.warn("[Auth Verify] No token found in URL");
    return redirect("/login?error=Invalid link");
  }

  const email = await checkMagicLinkWithoutConsuming(token);

  if (!email) {
    console.warn("[Auth Verify] Magic link verification pre-check failed (expired or invalid token)");
    return redirect("/login?error=Token expired or invalid");
  }

  return json({ token, email });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const token = formData.get("token") as string;

  if (!token) {
    return redirect("/login?error=Invalid session token");
  }

  try {
    const email = await verifyMagicLink(token);

    if (!email) {
      console.warn("[Auth Verify Action] Magic link verification failed (expired or invalid token)");
      return redirect("/login?error=Token expired or invalid");
    }

    console.log(`[Auth Verify Action] Verified email: ${email}. Attempting DB lookup...`);

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      console.log(`[Auth Verify Action] New user detected. Creating account for ${email}...`);
      user = await prisma.user.create({
        data: {
          email,
          passwordHash: "", // Empty string for passwordless users
          role: "USER",
          subscriptionTier: "free"
        }
      });
    }

    console.log(`[Auth Verify Action] Success! Creating session for user ID: ${user.id}`);
    return createUserSession(user.id, "/dashboard");
  } catch (error: any) {
    console.error("--------------------------------------------------");
    console.error("[Auth Verify Action] CRITICAL ERROR DURING LOGIN:");
    console.error("Message:", error.message);
    console.error("Stack:", error.stack);
    console.error("--------------------------------------------------");
    
    const errorMessage = error.message?.toLowerCase() || "";
    if (errorMessage.includes("database") || errorMessage.includes("prisma")) {
      return redirect("/login?error=Database connection error. Please try again.");
    }

    return redirect("/login?error=Could not complete secure sign-in. Please try again.");
  }
}

export default function VerifyRoute() {
  const { token, email } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6 text-[#1E293B]">
      <div className="max-w-md w-full bg-white p-8 md:p-10 rounded-[32px] border border-zinc-100 shadow-2xl relative overflow-hidden text-center animate-fade-in">
        <div className="absolute top-0 inset-x-0 h-1.5 bg-blue-600" />
        
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mx-auto mb-6">
          <ShieldCheck className="w-9 h-9" />
        </div>
        
        <h1 className="text-2xl font-black mb-3 text-zinc-900 tracking-tight">
          Verify Your Login
        </h1>
        
        <p className="text-zinc-500 text-sm font-semibold mb-8 leading-relaxed max-w-sm mx-auto">
          We received a secure login request for <span className="text-zinc-800 font-extrabold">{email}</span>. Click below to confirm and securely enter your workspace.
        </p>

        <Form method="post">
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 text-white rounded-2xl text-sm font-black py-4 hover:bg-blue-700 transition-all duration-150 cursor-pointer shadow-lg shadow-blue-500/10 disabled:bg-zinc-300 disabled:shadow-none"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing you in safely...
              </>
            ) : (
              <>
                Confirm Secure Sign In
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </Form>
        
        <p className="text-[11px] text-zinc-400 font-bold mt-6">
          Security provided by SiteGist Technologies.
        </p>
      </div>
    </div>
  );
}
