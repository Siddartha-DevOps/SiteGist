/**
 * Exact host / subdomain matching for the widget domain allowlist.
 * The old check used `origin.includes(domain)`, so an allowlist entry of
 * "example.com" also matched "example.com.attacker.com" or "notexample.com".
 * Here a configured "example.com" matches only "example.com" and "*.example.com".
 */
// Valid hostname: dot-separated labels of [a-z0-9-] (not starting/ending with a
// hyphen), or the bare token "localhost". Anything else (spaces, empty labels,
// junk) is rejected so a malformed allowlist entry can never match by accident.
export const HOSTNAME_RE = /^(localhost|([a-z0-9](-?[a-z0-9])*)(\.[a-z0-9](-?[a-z0-9])*)+)$/;

export function normalizeDomain(entry: string): string {
  let d = (entry || "").trim().toLowerCase();
  if (!d) return "";
  d = d.replace(/^https?:\/\//, ""); // strip scheme
  d = d.split("/")[0]; // strip path
  d = d.split(":")[0]; // strip port
  d = d.replace(/^\*\./, ""); // treat "*.example.com" as "example.com"
  return HOSTNAME_RE.test(d) ? d : ""; // reject malformed entries
}

export function originHost(origin: string | null): string | null {
  if (!origin) return null;
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isOriginAllowed(origin: string | null, allowedDomains: string[]): boolean {
  const host = originHost(origin);
  if (!host) return false; // allowlist is configured but request has no/invalid Origin → deny
  return allowedDomains.some((raw) => {
    const domain = normalizeDomain(raw);
    return !!domain && (host === domain || host.endsWith("." + domain));
  });
}
