import { Redis } from "@upstash/redis";
import { env } from "~/env.server";

let _redis: Redis | null = null;

export function getRedis() {
  if (!_redis) {
    const url = env.UPSTASH_REDIS_REST_URL;
    const token = env.UPSTASH_REDIS_REST_TOKEN;

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
