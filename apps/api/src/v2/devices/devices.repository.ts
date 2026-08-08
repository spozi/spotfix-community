import crypto from 'node:crypto';

import type { DeviceV2 } from '@prisma/client';
import { Prisma } from '@prisma/client';

import { prisma } from '../../infra/prisma';

export type DeviceV2Row = DeviceV2;

export interface RegisterDeviceInput {
    platform: 'android';
    deviceName?: string;
    deviceFingerprint: string;
    fcmToken?: string;
    appVersion?: string;
    osVersion?: string;
}

export function hashFingerprint(fingerprint: string): string {
    return crypto.createHash('sha256').update(fingerprint).digest('hex');
}

export const devicesV2Repository = {
    async findByFingerprintHash(hash: string): Promise<DeviceV2Row | null> {
        return prisma.deviceV2.findFirst({ where: { deviceFingerprintHash: hash } });
    },

    async findById(id: string): Promise<DeviceV2Row | null> {
        return prisma.deviceV2.findFirst({ where: { id } });
    },

    async upsert(input: RegisterDeviceInput): Promise<DeviceV2Row> {
        const hash = hashFingerprint(input.deviceFingerprint);
        const existing = await this.findByFingerprintHash(hash);
        const now = new Date();
        if (existing) {
            await prisma.deviceV2.updateMany({
                where: { id: existing.id },
                data: {
                    platform: input.platform,
                    deviceName: input.deviceName ?? existing.deviceName,
                    fcmToken: input.fcmToken ?? existing.fcmToken,
                    appVersion: input.appVersion ?? existing.appVersion,
                    osVersion: input.osVersion ?? existing.osVersion,
                    isActive: true,
                    lastSeenAt: now
                }
            });
            const refreshed = await this.findById(existing.id);
            return refreshed!;
        }

        return prisma.deviceV2.create({
            data: {
                platform: input.platform,
                deviceName: input.deviceName,
                deviceFingerprintHash: hash,
                fcmToken: input.fcmToken,
                appVersion: input.appVersion,
                osVersion: input.osVersion,
                isActive: true,
                lastSeenAt: now
            } as Prisma.DeviceV2UncheckedCreateInput
        });
    },

    async bindToUser(deviceId: string, userId: string): Promise<void> {
        await prisma.deviceV2.updateMany({
            where: { id: deviceId },
            data: { userId, lastSeenAt: new Date() }
        });
    },

    async touch(deviceId: string): Promise<void> {
        await prisma.deviceV2.updateMany({
            where: { id: deviceId },
            data: { lastSeenAt: new Date() }
        });
    }
};
