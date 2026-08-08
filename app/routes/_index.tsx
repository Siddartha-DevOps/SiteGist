import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { HomePage } from "~/frontend/pages/Home";
import {
  findProjectByVerifiedCustomDomain,
  isPlatformHost,
  requestHostname,
} from "~/lib/custom-domain.server";

/**
 * On a verified customer hostname (CNAME → our custom target), send visitors
 * to that project's embed page instead of the marketing home page.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const host = requestHostname(request);
  if (host && !isPlatformHost(host)) {
    try {
      const project = await findProjectByVerifiedCustomDomain(host);
      if (project) {
        throw redirect(`/embed/${project.id}`);
      }
    } catch (e) {
      // rethrow redirects; swallow DB/DNS lookup failures so marketing still loads
      if (e instanceof Response) throw e;
      console.error("[custom-domain] host lookup failed:", e);
    }
  }
  return json(null);
}

export default function Index() {
  return <HomePage />;
}
