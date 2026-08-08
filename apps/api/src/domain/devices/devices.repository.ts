import type { DeviceRegistration, Prisma } from '@prisma/client';

import { prisma } from '../../infra/prisma';

export type DeviceRegistrationRow = DeviceRegistration;

export interface UpsertDeviceRegistrationInput {
    userId?: string;
    masterUserId?: string;
    token: string;
    platform: 'android';
    appVersion?: string;
    deviceId?: string;
    deviceName?: string;
    notificationsEnabled?: boolean;
}

export const devicesRepository = {
    async upsert(input: UpsertDeviceRegistrationInput): Promise<DeviceRegistrationRow> {
        const existing = await prisma.deviceRegistration.findFirst({ where: { token: input.token } });

        if (existing) {
            await prisma.deviceRegistration.updateMany({
                where: { id: existing.id },
                data: {
                    userId: input.userId ?? null,
                    masterUserId: input.masterUserId ?? null,
                    platform: input.platform,
                    appVersion: input.appVersion ?? null,
                    deviceId: input.deviceId ?? null,
                    deviceName: input.deviceName ?? null,
                    notificationsEnabled: input.notificationsEnabled ?? true,
                    lastSeenAt: new Date()
                }
            });

            return (await prisma.deviceRegistration.findFirst({ where: { id: existing.id } })) as DeviceRegistrationRow;
        }

        const data: Prisma.DeviceRegistrationUncheckedCreateInput = {
            tenantId: '',
            userId: input.userId ?? null,
            masterUserId: input.masterUserId ?? null,
            token: input.token,
            platform: input.platform,
            appVersion: input.appVersion ?? null,
            deviceId: input.deviceId ?? null,
            deviceName: input.deviceName ?? null,
            notificationsEnabled: input.notificationsEnabled ?? true,
            lastSeenAt: new Date()
        };
        delete (data as { tenantId?: string }).tenantId;

        return prisma.deviceRegistration.create({ data });
    },

    async deleteForPrincipalToken(input: { userId?: string; masterUserId?: string; token: string }): Promise<void> {
        await prisma.deviceRegistration.deleteMany({
            where: {
                token: input.token,
                ...(input.userId ? { userId: input.userId } : {}),
                ...(input.masterUserId ? { masterUserId: input.masterUserId } : {})
            }
        });
    },

    async deleteByTokens(tokens: string[]): Promise<void> {
        if (tokens.length === 0) return;

        await prisma.deviceRegistration.deleteMany({
            where: { token: { in: tokens } }
        });
    },

    async listByRecipientIds(
        input: { userIds?: string[]; masterUserIds?: string[] },
        platform?: 'android'
    ): Promise<DeviceRegistrationRow[]> {
        const userIds = input.userIds?.filter(Boolean) ?? [];
        const masterUserIds = input.masterUserIds?.filter(Boolean) ?? [];
        if (userIds.length === 0 && masterUserIds.length === 0) return [];

        return prisma.deviceRegistration.findMany({
            where: {
                OR: [
                    ...(userIds.length > 0 ? [{ userId: { in: userIds } }] : []),
                    ...(masterUserIds.length > 0 ? [{ masterUserId: { in: masterUserIds } }] : [])
                ],
                notificationsEnabled: true,
                ...(platform ? { platform } : {})
            },
            orderBy: { lastSeenAt: 'desc' }
        });
    }
};
