import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

import { env } from '../config/env';
import { logger } from '../config/logger';
import { ForbiddenError } from '../errors';
import { currentTenantId } from './tenant-context';

// Models that always carry a tenantId column.
const TENANT_SCOPED_MODELS = new Set<string>([
    'UserAccount',
    'MasterUser',
    'Cleaner',
    'Report',
    'ReportSequence',
    'DeviceRegistration',
    'NotificationEvent',
    // v2
    'DeviceV2',
    'DeviceSession',
    'UserRoleV2',
    'ReportV2',
    'ReportAttachmentV2',
    'ReportEventV2',
    'NotificationV2',
    'TenantGeoV2',
    'CampusLandmarkV2'
]);

const READ_OPS = new Set<string>([
    'findFirst',
    'findFirstOrThrow',
    'findMany',
    'findUnique',
    'findUniqueOrThrow',
    'count',
    'aggregate',
    'groupBy'
]);

const WRITE_OPS = new Set<string>(['update', 'updateMany', 'delete', 'deleteMany']);

const CREATE_OPS = new Set<string>(['create', 'createMany', 'upsert']);

const pgPool = new Pool({ connectionString: env.DATABASE_URL });
const prismaAdapter = new PrismaPg(pgPool);

/**
 * The "raw" client — no tenant injection. Use only in:
 *   - bootstrap script (creates the very first tenant)
 *   - migration script (Mongo → Postgres ETL)
 *   - tenant-resolution middleware (look up Tenant by slug)
 *
 * Do NOT import this from request-handling code.
 */
export const prismaRaw = new PrismaClient({
    adapter: prismaAdapter,
    log: [
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' }
    ]
});

prismaRaw.$on('warn' as never, (e: unknown) => logger.warn({ prisma: e }, 'prisma warn'));
prismaRaw.$on('error' as never, (e: unknown) => logger.error({ prisma: e }, 'prisma error'));

/**
 * The application client — every query against a tenant-scoped model is
 * automatically constrained to the current tenant (resolved from
 * AsyncLocalStorage). Missing tenant context throws ForbiddenError.
 *
 * For findUnique-by-id calls we still need to add the tenant filter, but the
 * unique constraint on `id` alone would reject `{ id, tenantId }`. Repository
 * code therefore uses `findFirst` for tenant-scoped lookups.
 */
export const prisma = prismaRaw.$extends({
    name: 'tenant-scope',
    query: {
        $allModels: {
            async $allOperations({ model, operation, args, query }: {
                model: string;
                operation: string;
                args: unknown;
                query: (queryArgs: unknown) => unknown;
            }) {
                if (!TENANT_SCOPED_MODELS.has(model)) {
                    return query(args);
                }

                const tenantId = currentTenantId();
                if (!tenantId) {
                    throw new ForbiddenError(
                        `Tenant context required for ${model}.${operation}`
                    );
                }

                if (READ_OPS.has(operation) || WRITE_OPS.has(operation)) {
                    const a = (args ?? {}) as { where?: Record<string, unknown> };
                    a.where = { ...(a.where ?? {}), tenantId };
                    return query(a as typeof args);
                }

                if (CREATE_OPS.has(operation)) {
                    const a = args as {
                        data?: Record<string, unknown> | Array<Record<string, unknown>>;
                        create?: Record<string, unknown>;
                        update?: Record<string, unknown>;
                        where?: Record<string, unknown>;
                    };
                    if (operation === 'create') {
                        a.data = { ...(a.data as Record<string, unknown>), tenantId };
                    } else if (operation === 'createMany') {
                        if (Array.isArray(a.data)) {
                            a.data = a.data.map((row) => ({ ...row, tenantId }));
                        } else if (a.data) {
                            a.data = { ...a.data, tenantId };
                        }
                    } else if (operation === 'upsert') {
                        a.create = { ...(a.create ?? {}), tenantId };
                        a.where = { ...(a.where ?? {}), tenantId };
                    }
                    return query(args);
                }

                return query(args);
            }
        }
    }
});

export type AppPrismaClient = typeof prisma;
