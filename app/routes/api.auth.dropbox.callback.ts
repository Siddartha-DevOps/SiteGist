import type { LoaderFunctionArgs } from "@remix-run/node";
import { exchangeDropboxCode } from "~/backend/oauth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // projectId

  if (!code || !state) {
    return new Response("Missing code or state", { status: 400 });
  }

  try {
    await exchangeDropboxCode(code, state);

    return new Response(
      `<html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', provider: 'dropbox' }, '*');
              window.close();
            } else {
              window.location.href = '/dashboard/projects/' + "${state}" + '/train';
            }
          </script>
          <p>Dropbox connected. You can close this window.</p>
        </body>
      </html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (error: any) {
    console.error("Dropbox OAuth Error:", error);
    return new Response(`Authentication failed: ${error.message}`, { status: 500 });
  }
}
