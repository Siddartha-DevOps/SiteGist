/**
 * Structured, leveled logging.
 *
 * Emits one JSON object per line (timestamp, level, event, fields) so logs are
 * queryable in Vercel / any log drain. Use `startTimer` to record durations and
 * `log.metric` for numeric measurements (latency, counts, token usage) you want
 * to chart. Dependency-free and safe to call from anywhere on the server.
 */
type Fields = Record<string, unknown>;

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof LEVELS;

const MIN_LEVEL: Level =
  (process.env.LOG_LEVEL as Level) || (process.env.NODE_ENV === "production" ? "info" : "debug");

function emit(level: Level, event: string, fields?: Fields) {
  if (LEVELS[level] < LEVELS[MIN_LEVEL]) return;
  const record = { ts: new Date().toISOString(), level, event, ...sanitize(fields) };
  const line = JSON.stringify(record);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/** Drop undefined values and truncate long strings so logs stay clean. */
function sanitize(fields?: Fields): Fields {
  if (!fields) return {};
  const out: Fields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    out[k] = typeof v === "string" && v.length > 500 ? v.slice(0, 500) + "…" : v;
  }
  return out;
}

export const log = {
  debug: (event: string, fields?: Fields) => emit("debug", event, fields),
  info: (event: string, fields?: Fields) => emit("info", event, fields),
  warn: (event: string, fields?: Fields) => emit("warn", event, fields),
  error: (event: string, fields?: Fields) => emit("error", event, fields),
  /** A numeric measurement to chart (e.g. latency, counts, tokens). */
  metric: (name: string, value: number, fields?: Fields) =>
    emit("info", "metric", { metric: name, value, ...fields }),
};

/**
 * Start a timer. Returns a function that, when called, logs `event` with
 * `duration_ms` (plus any extra fields). Pass `ok: false` to mark failures.
 */
export function startTimer(event: string, fields?: Fields) {
  const t0 = Date.now();
  return (extra?: Fields) => {
    const duration_ms = Date.now() - t0;
    emit("info", event, { ...fields, ...extra, duration_ms });
    return duration_ms;
  };
}
