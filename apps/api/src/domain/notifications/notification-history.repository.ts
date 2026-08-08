import { Prisma, type NotificationEvent } from '@prisma/client';

import { prisma } from '../../infra/prisma';

export type NotificationEventRow = NotificationEvent;

export interface CreateNotificationHistoryInput {
    userId?: string;
    masterUserId?: string;
    reportPublicId?: string;
    type: string;
    title: string;
    body: string;
    payload?: Record<string, unknown>;
    isCritical?: boolean;
}

export const notificationHistoryRepository = {
    async create(input: CreateNotificationHistoryInput): Promise<NotificationEventRow> {
        const data: Prisma.NotificationEventUncheckedCreateInput = {
            tenantId: '',
            userId: input.userId ?? null,
            masterUserId: input.masterUserId ?? null,
            reportPublicId: input.reportPublicId ?? null,
            type: input.type,
            title: input.title,
            body: input.body,
            payload: (input.payload as Prisma.InputJsonValue | undefined) ?? {},
            isCritical: input.isCritical ?? false
        };
        delete (data as { tenantId?: string }).tenantId;
        return prisma.notificationEvent.create({ data });
    },

    async listForActor(actor: { authType: 'user' | 'master'; userId: string }, limit: number): Promise<NotificationEventRow[]> {
        return prisma.notificationEvent.findMany({
            where: actor.authType === 'master'
                ? { masterUserId: actor.userId }
                : { userId: actor.userId },
            orderBy: { createdAt: 'desc' },
            take: limit
        });
    }
};