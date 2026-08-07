import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

declare global {
  // allow global var across hot reloads in dev
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const createPrismaClient = () =>
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

export const db: PrismaClient =
  global.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = db;
}

export const connectDatabase = async () => {
  try {
    await db.$connect();
    logger.info('✅ PostgreSQL connected via Prisma');
  } catch (err) {
    logger.error('❌ Database connection failed:', err);
    process.exit(1);
  }
};

export const disconnectDatabase = async () => {
  await db.$disconnect();
  logger.info('Database disconnected');
};
