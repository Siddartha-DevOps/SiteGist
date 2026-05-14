import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

export function getRedis() {
  if (!_redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      console.warn("Redis credentials missing.");
      return null;
    }

    _redis = new Redis({
      url,
      token,
    });
  }
  return _redis;
}
