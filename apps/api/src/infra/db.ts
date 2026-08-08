import { logger } from '../config/logger';
import { prismaRaw } from './prisma';

/**
 * P2: Postgres is the system of record. Mongoose was removed.
 */
export async function connectDatabase(): Promise<void> {
    await prismaRaw.$connect();
    logger.info('Connected to Postgres via Prisma');
}

export async function disconnectDatabase(): Promise<void> {
    await prismaRaw.$disconnect();
}
