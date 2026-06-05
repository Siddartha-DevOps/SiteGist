import type { LoaderFunctionArgs } from "@remix-run/node";
import { exchangeZohoCode } from "~/backend/oauth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // This is the projectId

  if (!code || !state) {
    return new Response("Missing code or state", { status: 400 });
  }

  try {
    await exchangeZohoCode(code, state);

    return new Response(
      `<html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', provider: 'zoho' }, '*');
              window.close();
            } else {
              window.location.href = '/dashboard/projects/' + "${state}" + '/integrations';
            }
          </script>
          <p>Zoho Desk connected. You can close this window now.</p>
        </body>
      </html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (error: any) {
    console.error("Zoho OAuth Error:", error);
    return new Response(`Authentication failed: ${error.message}`, { status: 500 });
  }
}
