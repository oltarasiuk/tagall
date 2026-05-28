import { createClient, type RedisClientType } from "redis";
import { env } from "~/env";
import type { CACHE_KEYS } from "../constants/cache-keys.const";
import { buildCacheKey, type CacheKeyParams } from "./cache-key";

let client: RedisClientType | null = null;
let connectionFailed = false;

export const CACHE_TTL_SECONDS = {
  default: 60 * 60 * 24,
  public: 60 * 60 * 24 * 30,
} as const;

function isRedisConfigured(): boolean {
  return !!env.REDIS_HOST && !!env.REDIS_PORT;
}

async function getClient(): Promise<RedisClientType | null> {
  if (!isRedisConfigured() || connectionFailed) return null;
  if (client) return client;

  client = createClient({
    socket: {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      connectTimeout: 3000,
      reconnectStrategy: false,
    },
    ...(env.REDIS_PASSWORD && { password: env.REDIS_PASSWORD }),
    ...(env.REDIS_DB !== undefined && { database: env.REDIS_DB }),
  });

  client.on("error", () => {
    // Errors are expected when Redis is unavailable; suppress verbose output
  });

  try {
    await client.connect();
  } catch {
    console.warn("[Redis] Unavailable, running without cache");
    connectionFailed = true;
    client = null;
    return null;
  }

  return client;
}

async function getOrSetCacheByKey<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number,
): Promise<T> {
  const redis = await getClient();

  if (!redis) {
    return fetcher();
  }

  const startTime = Date.now();
  const raw = await redis.get(key);

  if (raw !== null) {
    const duration = Date.now() - startTime;
    console.log(`[Cache HIT] Key: "${key}" (${duration}ms)`);
    return JSON.parse(raw) as T;
  }

  console.log(`[Cache MISS] Key: "${key}" - fetching from database`);
  const dataStartTime = Date.now();
  const data = await fetcher();
  const dataDuration = Date.now() - dataStartTime;
  console.log(`[Cache MISS] Data fetched for "${key}" (${dataDuration}ms)`);

  const ttlSeconds = ttl ?? CACHE_TTL_SECONDS.default;

  const setCacheStartTime = Date.now();
  await redis.setEx(key, ttlSeconds, JSON.stringify(data));
  const setCacheDuration = Date.now() - setCacheStartTime;
  console.log(
    `[Cache SET] Key: "${key}" cached with TTL=${ttlSeconds}s (${setCacheDuration}ms)`,
  );

  return data;
}

async function deleteCacheByPrefix(keyPrefix: string): Promise<void> {
  const redis = await getClient();

  if (!redis) return;

  console.log(
    `[Cache INVALIDATE] Starting invalidation for prefix: "${keyPrefix}"`,
  );
  const startTime = Date.now();
  let totalDeleted = 0;
  const batchSize = 100;

  for await (const key of redis.scanIterator({
    MATCH: `${keyPrefix}*`,
    COUNT: batchSize,
  })) {
    await redis.del(key);
    totalDeleted++;
  }

  const duration = Date.now() - startTime;
  console.log(
    `[Cache INVALIDATE] Completed for "${keyPrefix}" - deleted ${totalDeleted} keys (${duration}ms)`,
  );
}

export async function deleteCache<
  Category extends keyof typeof CACHE_KEYS,
  Key extends keyof (typeof CACHE_KEYS)[Category],
>(
  category: Category,
  key: Key,
  params: Partial<CacheKeyParams<Category, Key>> = {},
): Promise<void> {
  const cacheKey = buildCacheKey(category, key, params);
  await deleteCacheByPrefix(cacheKey);
}

export async function getOrSetCache<
  T,
  Category extends keyof typeof CACHE_KEYS,
  Key extends keyof (typeof CACHE_KEYS)[Category],
>(
  fetcher: () => Promise<T>,
  category: Category,
  key: Key,
  params: Partial<CacheKeyParams<Category, Key>> = {},
  ttl?: number,
): Promise<T> {
  const cacheKey = buildCacheKey(category, key, params);
  return getOrSetCacheByKey(cacheKey, fetcher, ttl);
}

const redisClient = { getClient, getOrSetCache, deleteCache };

export default redisClient;
