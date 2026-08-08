import { prisma } from '../../infra/prisma';
import { currentTenantId } from '../../infra/tenant-context';
import { buildRoleSet, type V2RoleSet } from '../auth/roles';
import { V2NotFoundError } from '../errors';

type AssignableRole = 'supervisor' | 'cleaner';

export interface AdminUserSummary {
    id: string;
    name: string;
    email: string | null;
    idNumber: string;
    status: string;
    roles: V2RoleSet;
}

function tenantId(): string {
    const id = currentTenantId();
    if (!id) throw new Error('Tenant scope is not set.');
    return id;
}

function toSummary(row: {
    id: string;
    name: string;
    email: string | null;
    idNumber: string;
    status: string;
    role: string;
    rolesV2: Array<{ role: string }>;
}): AdminUserSummary {
    return {
        id: row.id,
        name: row.name,
        email: row.email,
        idNumber: row.idNumber,
        status: row.status,
        roles: buildRoleSet(row.role, row.rolesV2.map((entry) => entry.role))
    };
}

function normalizeSearch(search: string | undefined): string | undefined {
    const value = search?.trim();
    return value && value.length > 0 ? value : undefined;
}

export async function listAdminUsers(args: {
    search?: string;
    limit?: number;
}): Promise<AdminUserSummary[]> {
    const search = normalizeSearch(args.search);
    const limit = Math.min(200, Math.max(1, args.limit ?? 100));

    const users = await prisma.userAccount.findMany({
        where: {
            status: 'active',
            ...(search
                ? {
                    OR: [
                        { name: { contains: search, mode: 'insensitive' } },
                        { email: { contains: search, mode: 'insensitive' } },
                        { idNumber: { contains: search, mode: 'insensitive' } }
                    ]
                }
                : {})
        },
        select: {
            id: true,
            name: true,
            email: true,
            idNumber: true,
            status: true,
            role: true,
            rolesV2: {
                select: { role: true }
            }
        },
        orderBy: [{ name: 'asc' }, { registeredAt: 'asc' }],
        take: limit
    });

    return users.map(toSummary);
}

export async function assignRoleToUser(userId: string, role: AssignableRole): Promise<AdminUserSummary> {
    const tid = tenantId();

    const existing = await prisma.userAccount.findFirst({
        where: { id: userId, status: 'active' },
        select: { id: true }
    });
    if (!existing) throw new V2NotFoundError('User not found.');

    await prisma.userRoleV2.upsert({
        where: {
            tenantId_userId_role: {
                tenantId: tid,
                userId,
                role
            }
        },
        update: {},
        create: {
            tenantId: tid,
            userId,
            role
        }
    });

    const updated = await prisma.userAccount.findFirst({
        where: { id: userId },
        select: {
            id: true,
            name: true,
            email: true,
            idNumber: true,
            status: true,
            role: true,
            rolesV2: {
                select: { role: true }
            }
        }
    });
    if (!updated) throw new V2NotFoundError('User not found.');

    return toSummary(updated);
}