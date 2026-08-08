import type { MasterUser, Prisma } from '@prisma/client';

import { prisma } from '../../infra/prisma';

export type MasterUserRow = MasterUser;

export const masterRepository = {
    async findById(id: string): Promise<MasterUserRow | null> {
        return prisma.masterUser.findFirst({ where: { id } });
    },

    async listAll(): Promise<MasterUserRow[]> {
        return prisma.masterUser.findMany({ orderBy: { createdAt: 'desc' } });
    },

    async findByUsername(username: string): Promise<MasterUserRow | null> {
        return prisma.masterUser.findFirst({ where: { username } });
    },

    /** Count masters within the active tenant. */
    async count(): Promise<number> {
        return prisma.masterUser.count();
    },

    async create(input: { username: string; passwordHash: string; name: string }): Promise<MasterUserRow> {
        const data: Prisma.MasterUserUncheckedCreateInput = {
            tenantId: '',
            username: input.username,
            passwordHash: input.passwordHash,
            name: input.name,
            sessionVersion: 0
        };
        delete (data as { tenantId?: string }).tenantId;
        return prisma.masterUser.create({
            data: data as Prisma.MasterUserUncheckedCreateInput
        });
    },

    async recordLogin(id: string, opts: { newPasswordHash?: string }): Promise<void> {
        await prisma.masterUser.updateMany({
            where: { id },
            data: {
                lastLoginAt: new Date(),
                ...(opts.newPasswordHash ? { passwordHash: opts.newPasswordHash } : {})
            }
        });
    },

    async bumpSessionVersion(id: string): Promise<void> {
        await prisma.masterUser.updateMany({
            where: { id },
            data: { sessionVersion: { increment: 1 } }
        });
    }
};
