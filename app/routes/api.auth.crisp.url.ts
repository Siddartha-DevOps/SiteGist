import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { getCrispAuthUrl } from "~/backend/oauth.server";
import { requireUserId } from "~/backend/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  if (!projectId) return json({ error: "projectId is required" }, { status: 400 });

  try {
    const authUrl = getCrispAuthUrl(projectId);
    return json({ url: authUrl });
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}
