import type { Prisma, UserAccount } from '@prisma/client';

import { prisma } from '../../infra/prisma';
import type { UserRole } from '../auth/permissions';

export type UserAccountRow = UserAccount;

export interface CreateUserAccountInput {
    name: string;
    idNumber: string;
    phone?: string;
    workLocation?: string;
    passwordHash?: string | null;
    role: UserRole;
    googleSub?: string | null;
    email?: string | null;
}

export interface LinkGoogleInput {
    googleSub: string;
    email?: string | null;
}

export const usersRepository = {
    async findById(id: string): Promise<UserAccountRow | null> {
        // Use findFirst so the tenant extension can layer in tenantId.
        return prisma.userAccount.findFirst({ where: { id } });
    },

    async findByIdNumber(idNumber: string): Promise<UserAccountRow | null> {
        return prisma.userAccount.findFirst({ where: { idNumber } });
    },

    async findByGoogleSub(googleSub: string): Promise<UserAccountRow | null> {
        return prisma.userAccount.findFirst({ where: { googleSub } });
    },

    async findByEmail(email: string): Promise<UserAccountRow | null> {
        return prisma.userAccount.findFirst({ where: { email } });
    },

    async listAll(): Promise<UserAccountRow[]> {
        return prisma.userAccount.findMany({ orderBy: { registeredAt: 'desc' } });
    },

    async listByRoles(roles: UserRole[]): Promise<UserAccountRow[]> {
        return prisma.userAccount.findMany({
            where: {
                role: { in: roles },
                status: 'active'
            },
            orderBy: { registeredAt: 'desc' }
        });
    },

    async create(input: CreateUserAccountInput): Promise<UserAccountRow> {
        const data: Prisma.UserAccountUncheckedCreateInput = {
            tenantId: '',
            name: input.name,
            idNumber: input.idNumber,
            phone: input.phone,
            workLocation: input.workLocation,
            passwordHash: input.passwordHash ?? null,
            role: input.role,
            googleSub: input.googleSub ?? null,
            email: input.email ?? null,
            verified: true,
            status: 'active',
            loginCount: 0,
            sessionVersion: 0
        };
        delete (data as { tenantId?: string }).tenantId;
        return prisma.userAccount.create({
            data: data as Prisma.UserAccountUncheckedCreateInput
        });
    },

    async linkGoogle(id: string, input: LinkGoogleInput): Promise<void> {
        await prisma.userAccount.updateMany({
            where: { id },
            data: {
                googleSub: input.googleSub,
                ...(input.email ? { email: input.email } : {})
            }
        });
    },

    async recordLogin(id: string, opts: { newPasswordHash?: string }): Promise<void> {
        await prisma.userAccount.updateMany({
            where: { id },
            data: {
                lastLoginAt: new Date(),
                loginCount: { increment: 1 },
                ...(opts.newPasswordHash ? { passwordHash: opts.newPasswordHash } : {})
            }
        });
    },

    async bumpSessionVersion(id: string): Promise<void> {
        await prisma.userAccount.updateMany({
            where: { id },
            data: { sessionVersion: { increment: 1 } }
        });
    }
};
