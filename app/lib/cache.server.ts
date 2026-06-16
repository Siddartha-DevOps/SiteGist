/**
 * Best-effort Redis cache. No-ops gracefully when Redis isn't configured, so it's
 * always safe to call. Used to cache query embeddings (and other deterministic,
 * expensive results) to cut LLM/embedding cost and latency.
 */
import crypto from "crypto";
import { getRedis } from "./redis.server";

const PREFIX = "cache:";

export function cacheKey(...parts: (string | number)[]): string {
  return crypto.createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 40);
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const v = await redis.get(PREFIX + key);
    return (v as T) ?? null;
  } catch (e) {
    console.warn("[cache] get failed:", e);
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(PREFIX + key, value as any, { ex: ttlSeconds });
  } catch (e) {
    console.warn("[cache] set failed:", e);
  }
}
