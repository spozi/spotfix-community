import { Router } from 'express';

import { asyncHandler } from '../../../http/asyncHandler';
import { listNotifications, markRead } from '../../notifications/notifications.service';
import { getEventsSince } from '../../sync/sync.service';
import { requireV2Auth } from '../auth.middleware';
import { ok } from '../envelope';
import { NotificationsQuerySchema, SyncQuerySchema } from '../schemas';
import { serializeEvent, serializeNotification } from '../serializers';
import { validateV2 } from '../validate';

export function buildSyncV2Router(): Router {
    const router = Router();
    router.use(requireV2Auth);

    // GET /api/v2/sync/events?since=&limit=&report_id=
    router.get(
        '/events',
        validateV2(SyncQuerySchema, 'query'),
        asyncHandler(async (req, res) => {
            const ctx = req.v2Auth!;
            const q = req.query as { since?: number; limit?: number; report_id?: string };
            const { events, nextCursor } = await getEventsSince(
                {
                    since: q.since,
                    limit: q.limit,
                    reportId: q.report_id
                },
                ctx
            );
            ok(res, {
                events: events.map(serializeEvent),
                next_cursor: nextCursor
            });
        })
    );

    return router;
}

export function buildNotificationsV2Router(): Router {
    const router = Router();
    router.use(requireV2Auth);

    // GET /api/v2/notifications
    router.get(
        '/',
        validateV2(NotificationsQuerySchema, 'query'),
        asyncHandler(async (req, res) => {
            const ctx = req.v2Auth!;
            const q = req.query as { unread_only?: boolean; limit?: number };
            const rows = await listNotifications(ctx.userId, {
                unreadOnly: q.unread_only,
                limit: q.limit
            });
            ok(res, { notifications: rows.map(serializeNotification) });
        })
    );

    // PATCH /api/v2/notifications/:id/read
    router.patch(
        '/:id/read',
        asyncHandler(async (req, res) => {
            const ctx = req.v2Auth!;
            const row = await markRead(ctx.userId, String(req.params.id));
            ok(res, { notification: serializeNotification(row) });
        })
    );

    return router;
}
