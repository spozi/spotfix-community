import crypto from 'node:crypto';

import type { DeviceSession } from '@prisma/client';
import { Prisma } from '@prisma/client';

import { prisma } from '../../infra/prisma';

export type DeviceSessionRow = DeviceSession;

export function hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

export const deviceSessionsRepository = {
    async findActiveById(id: string): Promise<DeviceSessionRow | null> {
        return prisma.deviceSession.findFirst({ where: { id, isActive: true } });
    },

    async findActiveByDevice(deviceId: string): Promise<DeviceSessionRow | null> {
        return prisma.deviceSession.findFirst({ where: { deviceId, isActive: true } });
    },

    /**
     * Revoke every active session for the given device. Called before issuing a
     * new session so a device is bound to at most one account at a time.
     */
    async revokeAllForDevice(deviceId: string): Promise<void> {
        await prisma.deviceSession.updateMany({
            where: { deviceId, isActive: true },
            data: { isActive: false, revokedAt: new Date() }
        });
    },

    async create(input: {
        deviceId: string;
        userId: string;
        refreshTokenHash: string;
    }): Promise<DeviceSessionRow> {
        return prisma.deviceSession.create({
            data: {
                deviceId: input.deviceId,
                userId: input.userId,
                refreshTokenHash: input.refreshTokenHash,
                isActive: true,
                lastUsedAt: new Date()
            } as Prisma.DeviceSessionUncheckedCreateInput
        });
    },

    async updateRefreshToken(id: string, refreshTokenHash: string): Promise<void> {
        await prisma.deviceSession.updateMany({
            where: { id },
            data: { refreshTokenHash, lastUsedAt: new Date() }
        });
    },

    async touch(id: string): Promise<void> {
        await prisma.deviceSession.updateMany({
            where: { id },
            data: { lastUsedAt: new Date() }
        });
    },

    async revoke(id: string): Promise<void> {
        await prisma.deviceSession.updateMany({
            where: { id },
            data: { isActive: false, revokedAt: new Date() }
        });
    }
};
