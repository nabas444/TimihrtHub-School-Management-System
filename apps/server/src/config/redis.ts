import { Redis, RedisOptions } from 'ioredis';
import { logger } from '../utils/logger';

function getRedisUrl(): string {
  let rawUrl = (process.env.REDIS_URL ?? 'redis://localhost:6379').trim();

  // Remove wrapping quotes if present
  rawUrl = rawUrl.replace(/^["']|["']$/g, '');

  // If user accidentally copied the redis-cli command (e.g. "redis-cli --tls -u redis://...")
  if (rawUrl.includes('-u ')) {
    const parts = rawUrl.split('-u ');
    rawUrl = parts[parts.length - 1].trim();
  } else if (rawUrl.startsWith('redis-cli ')) {
    rawUrl = rawUrl.replace(/^redis-cli\s+/, '').trim();
  }

  // For Upstash or cloud TLS endpoints, ensure rediss:// protocol is used
  if (rawUrl.includes('upstash.io') && rawUrl.startsWith('redis://')) {
    rawUrl = rawUrl.replace(/^redis:\/\//, 'rediss://');
  }

  return rawUrl;
}

const redisOptions: RedisOptions = {
  maxRetriesPerRequest: null, // required for BullMQ
  enableReadyCheck: false,
  lazyConnect: true,
};

const resolvedRedisUrl = getRedisUrl();

// Main Redis client
export const redis = new Redis(resolvedRedisUrl, redisOptions);
redis.on('error', (err) => logger.warn(`Redis connection error: ${err.message}`));

// Separate connection for BullMQ subscribers (can't share)
export const redisSub = new Redis(resolvedRedisUrl, redisOptions);
redisSub.on('error', (err) => logger.warn(`RedisSub connection error: ${err.message}`));

export const connectRedis = async () => {
  try {
    await redis.connect();
    logger.info('✅ Redis connected');
  } catch (err) {
    logger.warn('⚠️ Redis connection warning (cache will run in degraded mode):', err);
  }
};

// Helpers
export const cacheGet = async <T>(key: string): Promise<T | null> => {
  const val = await redis.get(key);
  return val ? (JSON.parse(val) as T) : null;
};

export const cacheSet = async (
  key: string,
  value: unknown,
  ttlSeconds: number = 300,
): Promise<void> => {
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
};

export const cacheDel = async (...keys: string[]): Promise<void> => {
  if (keys.length > 0) await redis.del(...keys);
};

export const cacheKeys = async (pattern: string): Promise<string[]> => {
  return redis.keys(pattern);
};
