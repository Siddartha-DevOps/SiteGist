/**
 * Custom domain helpers: normalize hostnames, DNS CNAME verification, and
 * lookup of projects that have verified a custom host.
 *
 * Customers CNAME their hostname to CUSTOM_DOMAIN_CNAME_TARGET (default
 * `custom.<APP_HOSTNAME>`). Once verified, requests arriving with that Host
 * are redirected to `/embed/:projectId`.
 */
import dns from "node:dns/promises";
import { prisma } from "~/database/db.server";
import { normalizeDomain } from "~/lib/domains";

export type CustomDomainStatus = "unverified" | "verified" | "failed";

export function getAppHostname(): string {
  const raw =
    process.env.APP_HOSTNAME?.trim() ||
    process.env.VITE_APP_HOSTNAME?.trim() ||
    "localhost";
  return raw.replace(/^https?:\/\//, "").split("/")[0].toLowerCase();
}

/** Host our docs tell customers to CNAME to. */
export function getCustomDomainCnameTarget(): string {
  const explicit = process.env.CUSTOM_DOMAIN_CNAME_TARGET?.trim();
  if (explicit) return explicit.replace(/\.$/, "").toLowerCase();
  const app = getAppHostname();
  if (app === "localhost") return "custom.localhost";
  return `custom.${app}`;
}

export function getAppHosts(): Set<string> {
  const app = getAppHostname();
  const hosts = new Set<string>([
    app,
    `www.${app}`,
    "localhost",
    "127.0.0.1",
  ]);
  const extras = (process.env.APP_HOSTS || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  for (const h of extras) hosts.add(h);
  return hosts;
}

export function isPlatformHost(hostname: string | null | undefined): boolean {
  if (!hostname) return true;
  const host = hostname.split(":")[0].toLowerCase();
  if (getAppHosts().has(host)) return true;
  // Vercel preview / deployment URLs
  if (host.endsWith(".vercel.app")) return true;
  return false;
}

export function normalizeCustomDomainInput(raw: string): string {
  return normalizeDomain(raw);
}

export type DnsVerifyResult =
  | { ok: true; cnames: string[] }
  | { ok: false; error: string; cnames?: string[] };

/**
 * Verify that `hostname` has a CNAME chain pointing at our target
 * (or equals the target after following CNAMEs).
 */
export async function verifyCustomDomainDns(hostname: string): Promise<DnsVerifyResult> {
  const host = normalizeCustomDomainInput(hostname);
  if (!host) return { ok: false, error: "Enter a valid hostname (e.g. chat.example.com)." };
  if (isPlatformHost(host)) {
    return { ok: false, error: "That hostname is reserved for the platform." };
  }

  const target = getCustomDomainCnameTarget();
  try {
    const seen = new Set<string>();
    let current = host;
    const found: string[] = [];

    for (let depth = 0; depth < 8; depth++) {
      if (seen.has(current)) break;
      seen.add(current);
      let records: string[] = [];
      try {
        records = await dns.resolveCname(current);
      } catch (e: any) {
        const code = e?.code as string | undefined;
        if (code === "ENODATA" || code === "ENOTFOUND") {
          return {
            ok: false,
            error: `No CNAME found for ${host}. Add a CNAME record pointing to ${target}.`,
            cnames: found,
          };
        }
        return { ok: false, error: `DNS lookup failed: ${e?.message || code || "unknown error"}` };
      }
      const normalized = records.map((r) => r.replace(/\.$/, "").toLowerCase());
      found.push(...normalized);
      if (normalized.some((r) => r === target || r.endsWith("." + target))) {
        return { ok: true, cnames: found };
      }
      // Follow first CNAME hop
      if (normalized[0]) {
        current = normalized[0];
        continue;
      }
      break;
    }

    return {
      ok: false,
      error: `CNAME for ${host} does not point to ${target}. Current: ${found.join(", ") || "(none)"}.`,
      cnames: found,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || "DNS verification failed." };
  }
}

/** Find a project whose branding.customDomain matches and is verified. */
export async function findProjectByVerifiedCustomDomain(hostname: string): Promise<{ id: string; name: string } | null> {
  const host = normalizeCustomDomainInput(hostname);
  if (!host || isPlatformHost(host)) return null;

  // Postgres JSON path query — settings.branding.customDomain
  const rows = await prisma.$queryRaw<{ id: string; name: string }[]>`
    SELECT id, name FROM "Project"
    WHERE LOWER(COALESCE(settings->'branding'->>'customDomain', '')) = ${host}
      AND COALESCE(settings->'branding'->>'customDomainStatus', '') = 'verified'
    LIMIT 1
  `;
  return rows[0] || null;
}

export function requestHostname(request: Request): string | null {
  const raw =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    "";
  const host = raw.split(",")[0]?.trim().split(":")[0]?.toLowerCase();
  return host || null;
}
