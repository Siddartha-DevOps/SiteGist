// Lightweight client-side error capture that mirrors the hand-rolled server
// reporter (monitoring.server.ts): it posts a Sentry envelope for uncaught
// errors and unhandled promise rejections. No SDK dependency. Symbolication
// requires uploading source maps to Sentry for the matching `release`
// (VERCEL_GIT_COMMIT_SHA) — see docs/RUNBOOK.md.

function parseDsn(raw: string): { endpoint: string } | null {
  try {
    const url = new URL(raw);
    const publicKey = url.username;
    const projectId = url.pathname.replace(/^\/+/, "");
    if (!publicKey || !projectId) return null;
    return {
      endpoint: `${url.protocol}//${url.host}/api/${projectId}/envelope/?sentry_key=${publicKey}&sentry_version=7`,
    };
  } catch {
    return null;
  }
}

function randomHex(n: number): string {
  let o = "";
  for (let i = 0; i < n; i++) o += "0123456789abcdef"[Math.floor(Math.random() * 16)];
  return o;
}

let installed = false;

export function initClientErrorReporting(): void {
  if (installed || typeof window === "undefined") return;
  const env = (window as any).ENV || {};
  const parsed = env.SENTRY_DSN ? parseDsn(env.SENTRY_DSN) : null;
  if (!parsed) return; // no DSN configured → no-op
  installed = true;

  const send = (err: Error, extra: Record<string, unknown>) => {
    const eventId = randomHex(32);
    const event = {
      event_id: eventId,
      timestamp: Date.now() / 1000,
      platform: "javascript",
      level: "error",
      environment: env.NODE_ENV || "production",
      release: env.BUILD_SHA || undefined,
      exception: { values: [{ type: err.name || "Error", value: err.message }] },
      request: { url: location.href, headers: { "User-Agent": navigator.userAgent } },
      extra: { ...extra, stack: err.stack },
    };
    const body =
      JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() }) +
      "\n" +
      JSON.stringify({ type: "event" }) +
      "\n" +
      JSON.stringify(event);
    // keepalive lets the report flush even during a navigation/unload.
    fetch(parsed.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope" },
      body,
      keepalive: true,
    }).catch(() => {});
  };

  window.addEventListener("error", (e: ErrorEvent) => {
    const err = e.error instanceof Error ? e.error : new Error(e.message || "Uncaught error");
    send(err, { source: "window.error", filename: e.filename, lineno: e.lineno, colno: e.colno });
  });
  window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
    const reason: any = e.reason;
    const err = reason instanceof Error ? reason : new Error(typeof reason === "string" ? reason : "Unhandled promise rejection");
    send(err, { source: "unhandledrejection" });
  });
}
