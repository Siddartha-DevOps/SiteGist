type ErrorContext = Record<string, unknown> & { where?: string };
interface ParsedDsn { endpoint: string; publicKey: string }
let _dsn: ParsedDsn | null | undefined;

function parseDsn(): ParsedDsn | null {
  if (_dsn !== undefined) return _dsn;
  const raw = (process.env.SENTRY_DSN || "").trim();
  if (!raw) { _dsn = null; return _dsn; }
  try {
    const url = new URL(raw);
    const publicKey = url.username;
    const projectId = url.pathname.replace(/^\/+/, "");
    if (!publicKey || !projectId) { _dsn = null; return _dsn; }
    _dsn = { endpoint: `${url.protocol}//${url.host}/api/${projectId}/envelope/?sentry_key=${publicKey}&sentry_version=7`, publicKey };
  } catch { _dsn = null; }
  return _dsn;
}
function randomHex(n: number): string { let o=""; const c="0123456789abcdef"; for (let i=0;i<n;i++) o+=c[Math.floor(Math.random()*16)]; return o; }

export function captureException(error: unknown, context: ErrorContext = {}): void {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error("[captureException]", { where: context.where, message: err.message, ...context });
  const dsn = parseDsn();
  if (!dsn) return;
  const eventId = randomHex(32);
  const event = { event_id: eventId, timestamp: Date.now()/1000, platform: "node", level: "error",
    environment: process.env.NODE_ENV || "development", server_name: "sitegist",
    exception: { values: [{ type: err.name || "Error", value: err.message }] }, extra: context,
    tags: context.where ? { where: String(context.where) } : undefined };
  const envelope = JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() }) + "\n" + JSON.stringify({ type: "event" }) + "\n" + JSON.stringify(event);
  fetch(dsn.endpoint, { method: "POST", headers: { "Content-Type": "application/x-sentry-envelope" }, body: envelope }).catch(() => {});
}
