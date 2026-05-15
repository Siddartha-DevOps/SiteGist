import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useActionData, useNavigation } from "@remix-run/react";
import { prisma } from "~/database/db.server";
import { getUserId } from "~/backend/auth.server";
import { generateMagicLink } from "~/backend/magic-link.server";
import { verifyTurnstile } from "~/backend/security.server";
import { LoginPage } from "~/frontend/pages/Login";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await getUserId(request);
  if (userId) return redirect("/dashboard");
  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get("email");
  const turnstileToken = formData.get("cf-turnstile-response");

  if (typeof email !== "string" || !email.includes("@")) {
    return json({ error: "Please enter a valid email address" }, { status: 400 });
  }

  // Verify Turnstile if key is provided
  if (process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY) {
    if (typeof turnstileToken !== "string" || !(await verifyTurnstile(turnstileToken))) {
      return json({ error: "Security check failed. Please try again." }, { status: 400 });
    }
  }

  try {
    const baseUrl = new URL(request.url).origin;
    await generateMagicLink(email, baseUrl);
    return json({ success: true, email });
  } catch (error) {
    console.error("Magic Link Error:", error);
    return json({ error: "Failed to send login link. Please try again." }, { status: 500 });
  }
}

export default function Login() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const error = actionData && "error" in actionData ? actionData.error : undefined;
  const success = actionData && "success" in actionData ? actionData.success : undefined;
  const sentEmail = actionData && "email" in actionData ? actionData.email : undefined;

  return (
    <LoginPage 
      error={error} 
      success={success}
      sentEmail={sentEmail}
      isSubmitting={isSubmitting} 
    />
  );
}
