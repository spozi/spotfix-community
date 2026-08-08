import { Router } from 'express';

import { notificationHistoryService } from '../../domain/notifications/notification-history.service';
import { asyncHandler } from '../asyncHandler';
import { requireAuth, requireRoles } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { NotificationListQuerySchema } from '../schemas';

export function buildNotificationsRouter(): Router {
    const router = Router();

    router.get(
        '/',
        requireAuth,
        requireRoles('public', 'supervisor', 'cleaner', 'master'),
        validate(NotificationListQuerySchema, 'query'),
        asyncHandler(async (req, res) => {
            const limit = (req.query as { limit?: number }).limit ?? 50;
            res.json(await notificationHistoryService.listForActor({
                authType: req.auth!.authType,
                userId: req.auth!.userId
            }, limit));
        })
    );

    return router;
}