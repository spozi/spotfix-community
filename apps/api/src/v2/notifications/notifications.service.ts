/**
 * v2 notifications service. Implements §13.2 / §13.3.
 *
 * Notifications are scoped to the calling user. Marking a notification as read
 * is a no-op if it is already read.
 */
import type { NotificationV2 } from '@prisma/client';

import { prisma } from '../../infra/prisma';
import { V2NotFoundError } from '../errors';

export async function listNotifications(userId: string, args: {
    unreadOnly?: boolean;
    limit?: number;
}): Promise<NotificationV2[]> {
    const limit = Math.min(200, Math.max(1, args.limit ?? 50));
    return prisma.notificationV2.findMany({
        where: { userId, ...(args.unreadOnly ? { isRead: false } : {}) },
        orderBy: { createdAt: 'desc' },
        take: limit
    });
}

export async function markRead(userId: string, notificationId: string): Promise<NotificationV2> {
    const existing = await prisma.notificationV2.findFirst({
        where: { id: notificationId, userId }
    });
    if (!existing) throw new V2NotFoundError('Notification not found.');
    if (existing.isRead) return existing;

    const now = new Date();
    await prisma.notificationV2.updateMany({
        where: { id: notificationId },
        data: { isRead: true, readAt: now }
    });
    return { ...existing, isRead: true, readAt: now };
}
