import { Redis } from 'ioredis';
import { logger } from '../utils/logger';

const redisOptions = {
  maxRetriesPerRequest: null, // required for BullMQ
  enableReadyCheck: false,
  lazyConnect: true,
};

// Main Redis client
export const redis = new Redis(
  process.env.REDIS_URL ?? 'redis://localhost:6379',
  redisOptions,
);

// Separate connection for BullMQ subscribers (can't share)
export const redisSub = new Redis(
  process.env.REDIS_URL ?? 'redis://localhost:6379',
  redisOptions,
);

export const connectRedis = async () => {
  try {
    await redis.connect();
    logger.info('✅ Redis connected');
  } catch (err) {
    logger.error('❌ Redis connection failed:', err);
    process.exit(1);
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
