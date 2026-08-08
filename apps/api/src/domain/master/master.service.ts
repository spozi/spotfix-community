import { ConflictError, ForbiddenError } from '../../errors';
import { hashPassword } from '../auth/password';
import { masterRepository, type MasterUserRow } from './master.repository';

export interface CreateMasterInput {
    username: string;
    password: string;
    name: string;
}

export interface SerializedMaster {
    _id: string;
    username: string;
    name: string;
    createdAt?: Date;
    lastLoginAt?: Date;
}

export function serializeMaster(row: MasterUserRow): SerializedMaster {
    return {
        _id: row.id,
        username: row.username,
        name: row.name,
        createdAt: row.createdAt ?? undefined,
        lastLoginAt: row.lastLoginAt ?? undefined
    };
}

export const masterService = {
    /**
     * Create a master within the currently-resolved tenant.
     * - First master in tenant: public (bootstrap path).
     * - Otherwise: caller must already be a master of the same tenant.
     */
    async create(input: CreateMasterInput, actor: { role: string } | null): Promise<SerializedMaster> {
        const totalMasters = await masterRepository.count();

        if (totalMasters > 0 && actor?.role !== 'master') {
            throw new ForbiddenError('Only an existing master can create additional master accounts');
        }

        const existing = await masterRepository.findByUsername(input.username);
        if (existing) {
            throw new ConflictError('Master with this username already exists');
        }

        const created = await masterRepository.create({
            username: input.username,
            passwordHash: await hashPassword(input.password),
            name: input.name
        });

        return serializeMaster(created);
    }
};
