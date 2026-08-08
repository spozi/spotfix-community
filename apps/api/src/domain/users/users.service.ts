import { ConflictError, ForbiddenError, NotFoundError } from '../../errors';
import { hashPassword } from '../auth/password';
import type { AuthRole, UserRole } from '../auth/permissions';
import { normalizeUserRole } from '../auth/permissions';
import { usersRepository, type UserAccountRow } from './users.repository';

export interface SerializedUser {
    _id: string;
    name: string;
    idNumber: string;
    email?: string;
    phone?: string;
    workLocation?: string;
    role: UserRole;
    verified: boolean;
    registeredAt?: Date;
    lastLoginAt?: Date;
    loginCount: number;
    status: string;
    authProvider: 'password' | 'google';
}

export function serializeUserAccount(row: UserAccountRow): SerializedUser {
    return {
        _id: row.id,
        name: row.name,
        idNumber: row.idNumber,
        email: row.email ?? undefined,
        phone: row.phone ?? undefined,
        workLocation: row.workLocation ?? undefined,
        role: normalizeUserRole(row.role),
        verified: Boolean(row.verified),
        registeredAt: row.registeredAt ?? undefined,
        lastLoginAt: row.lastLoginAt ?? undefined,
        loginCount: Number(row.loginCount ?? 0),
        status: row.status ?? 'active',
        authProvider: row.googleSub ? 'google' : 'password'
    };
}

function normalizeEmail(email?: string | null): string | undefined {
    if (!email) return undefined;
    const trimmed = email.trim().toLowerCase();
    return trimmed.length > 0 ? trimmed : undefined;
}

export interface RegisterPublicInput {
    name: string;
    idNumber: string;
    email: string;
    phone?: string;
    password: string;
}

export interface ProvisionUserInput {
    name: string;
    idNumber: string;
    email?: string;
    phone?: string;
    workLocation?: string;
    password: string;
    role: UserRole;
}

export const usersService = {
    async registerPublic(input: RegisterPublicInput): Promise<SerializedUser> {
        const existingById = await usersRepository.findByIdNumber(input.idNumber);
        if (existingById) {
            throw new ConflictError('User with this ID already registered');
        }

        const email = normalizeEmail(input.email);
        if (email) {
            const existingByEmail = await usersRepository.findByEmail(email);
            if (existingByEmail) {
                throw new ConflictError('Email is already registered');
            }
        }

        const created = await usersRepository.create({
            name: input.name,
            idNumber: input.idNumber,
            email,
            phone: input.phone,
            passwordHash: await hashPassword(input.password),
            role: 'public'
        });

        return serializeUserAccount(created);
    },

    async provision(input: ProvisionUserInput, actor: { role: AuthRole }): Promise<SerializedUser> {
        const allowedRoles: UserRole[] = actor.role === 'master'
            ? ['public', 'supervisor', 'cleaner']
            : actor.role === 'supervisor'
                ? ['cleaner']
                : [];

        if (!allowedRoles.includes(input.role)) {
            throw new ForbiddenError('You cannot provision that role');
        }

        const existingById = await usersRepository.findByIdNumber(input.idNumber);
        if (existingById) {
            throw new ConflictError('User with this ID already registered');
        }

        const email = normalizeEmail(input.email);
        if (email) {
            const existingByEmail = await usersRepository.findByEmail(email);
            if (existingByEmail) {
                throw new ConflictError('Email is already registered');
            }
        }

        const created = await usersRepository.create({
            name: input.name,
            idNumber: input.idNumber,
            email,
            phone: input.phone,
            workLocation: input.workLocation,
            passwordHash: await hashPassword(input.password),
            role: input.role
        });

        return serializeUserAccount(created);
    },

    async listAll(): Promise<SerializedUser[]> {
        const users = await usersRepository.listAll();
        return users.map(serializeUserAccount);
    },

    async getPublicProfile(userId: string): Promise<SerializedUser> {
        const user = await usersRepository.findById(userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }

        return serializeUserAccount(user);
    }
};
