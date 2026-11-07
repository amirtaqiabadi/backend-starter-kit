import Redis from "ioredis";

const globalForRedis = globalThis as { redis?: Redis };

/** Why: route handlers and tests share one connection instead of opening a client per call. */
export function getRedis(url = process.env.REDIS_URL ?? "redis://:app@127.0.0.1:6379"): Redis {
  if (!globalForRedis.redis) {
    globalForRedis.redis = new Redis(url, { maxRetriesPerRequest: 2 });
  }
  return globalForRedis.redis;
}
