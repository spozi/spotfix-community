import { notificationHistoryRepository } from './notification-history.repository';

export interface SerializedNotificationEvent {
    _id: string;
    reportId?: string;
    type: string;
    title: string;
    body: string;
    isCritical: boolean;
    payload: Record<string, unknown>;
    createdAt: Date;
}

function serializeNotificationEvent(row: {
    id: string;
    reportPublicId: string | null;
    type: string;
    title: string;
    body: string;
    isCritical: boolean;
    payload: unknown;
    createdAt: Date;
}): SerializedNotificationEvent {
    return {
        _id: row.id,
        reportId: row.reportPublicId ?? undefined,
        type: row.type,
        title: row.title,
        body: row.body,
        isCritical: row.isCritical,
        payload: (row.payload as Record<string, unknown> | null) ?? {},
        createdAt: row.createdAt
    };
}

export const notificationHistoryService = {
    async record(input: {
        userIds?: string[];
        masterUserIds?: string[];
        reportPublicId?: string;
        type: string;
        title: string;
        body: string;
        payload?: Record<string, unknown>;
        isCritical?: boolean;
    }): Promise<void> {
        const userIds = Array.from(new Set(input.userIds?.filter(Boolean) ?? []));
        const masterUserIds = Array.from(new Set(input.masterUserIds?.filter(Boolean) ?? []));

        for (const userId of userIds) {
            await notificationHistoryRepository.create({
                userId,
                reportPublicId: input.reportPublicId,
                type: input.type,
                title: input.title,
                body: input.body,
                payload: input.payload,
                isCritical: input.isCritical
            });
        }

        for (const masterUserId of masterUserIds) {
            await notificationHistoryRepository.create({
                masterUserId,
                reportPublicId: input.reportPublicId,
                type: input.type,
                title: input.title,
                body: input.body,
                payload: input.payload,
                isCritical: input.isCritical
            });
        }
    },

    async listForActor(actor: { authType: 'user' | 'master'; userId: string }, limit: number): Promise<SerializedNotificationEvent[]> {
        const rows = await notificationHistoryRepository.listForActor(actor, limit);
        return rows.map(serializeNotificationEvent);
    }
};