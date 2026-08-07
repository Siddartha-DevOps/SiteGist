/**
 * Authorize scheduled cron invocations.
 * Accepts: ?token=, x-cron-secret header, or Authorization: Bearer (Vercel Crons).
 */
export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const url = new URL(request.url);
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : authHeader?.trim();

  const token =
    url.searchParams.get("token") ||
    request.headers.get("x-cron-secret") ||
    bearer;

  return token === secret;
}
