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
  retryStrategy: (times) => {
    if (times > 3) return null; // Stop spamming reconnect on auth failure
    return Math.min(times * 1000, 3000);
  },
  reconnectOnError: (err) => {
    if (err.message.includes('WRONGPASS') || err.message.includes('NOAUTH')) {
      return false;
    }
    return true;
  },
};

const resolvedRedisUrl = getRedisUrl();

// Main Redis client
export const redis = new Redis(resolvedRedisUrl, redisOptions);
redis.on('error', (err) => {
  if (!err.message.includes('WRONGPASS')) {
    logger.warn(`Redis error: ${err.message}`);
  }
});

// Separate connection for BullMQ subscribers (can't share)
export const redisSub = new Redis(resolvedRedisUrl, redisOptions);
redisSub.on('error', (err) => {
  if (!err.message.includes('WRONGPASS')) {
    logger.warn(`RedisSub error: ${err.message}`);
  }
});

export const connectRedis = async () => {
  try {
    await redis.connect();
    logger.info('✅ Redis connected');
  } catch (err: any) {
    logger.warn('⚠️ Redis connection notice (running in direct database mode without Redis cache):', err.message);
  }
};

// Helpers (safe against offline/unauthenticated Redis)
export const cacheGet = async <T>(key: string): Promise<T | null> => {
  try {
    if (redis.status !== 'ready') return null;
    const val = await redis.get(key);
    return val ? (JSON.parse(val) as T) : null;
  } catch {
    return null;
  }
};

export const cacheSet = async (
  key: string,
  value: unknown,
  ttlSeconds: number = 300,
): Promise<void> => {
  try {
    if (redis.status !== 'ready') return;
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // Graceful fallback
  }
};

export const cacheDel = async (...keys: string[]): Promise<void> => {
  try {
    if (redis.status !== 'ready') return;
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // Graceful fallback
  }
};

export const cacheKeys = async (pattern: string): Promise<string[]> => {
  try {
    if (redis.status !== 'ready') return [];
    return await redis.keys(pattern);
  } catch {
    return [];
  }
};
