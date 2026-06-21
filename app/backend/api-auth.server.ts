import { json } from "@remix-run/node";
import crypto from "crypto";
import { prisma } from "~/database/db.server";
import { getRedis } from "~/lib/redis.server";

const API_KEY_PREFIX = "sk_live_";

export function generateApiKey(): string {
  return API_KEY_PREFIX + crypto.randomBytes(24).toString("hex");
}

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/**
 * Validates the Bearer API key from the Authorization header.
 * Returns the owning user, or THROWS a JSON Response (401) — which Remix
 * loaders/actions surface directly to the API caller.
 */
export async function requireApiKey(request: Request) {
  const header = request.headers.get("Authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    throw json({ error: "Missing API key. Use 'Authorization: Bearer <key>'." }, { status: 401 });
  }

  const keyHash = hashApiKey(token);
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { user: true },
  });

  if (!apiKey || apiKey.revokedAt) {
    throw json({ error: "Invalid or revoked API key." }, { status: 401 });
  }

  // Fire-and-forget usage timestamp
  prisma.apiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return apiKey.user;
}

/**
 * Per-user, fixed-window API rate limit (default 120 req/min, override via
 * API_RATE_LIMIT_PER_MIN). THROWS a JSON 429 Response when exceeded. Fails open
 * if Redis isn't configured/reachable so the API never goes down on a cache blip.
 */
export async function enforceApiRateLimit(userId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return; // no limiter configured → fail open
  const limit = parseInt(process.env.API_RATE_LIMIT_PER_MIN || "120", 10);
  const bucket = Math.floor(Date.now() / 60000);
  const key = `apilimit:${userId}:${bucket}`;

  let count: number;
  try {
    count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 70);
  } catch {
    return; // Redis error → fail open
  }

  if (count > limit) {
    throw json(
      { error: "rate_limited", message: `API rate limit of ${limit} requests/min exceeded.` },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }
}
