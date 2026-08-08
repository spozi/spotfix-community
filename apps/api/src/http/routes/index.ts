import { Router } from 'express';

import { attachAuth } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import { buildCleanersRouter } from './cleaners.routes';
import { buildDevicesRouter } from './devices.routes';
import { buildMasterRouter } from './master.routes';
import { buildMeRouter } from './me.routes';
import { buildNotificationsRouter } from './notifications.routes';
import { buildReportsRouter } from './reports.routes';
import { buildSupervisorsRouter } from './supervisors.routes';
import { buildUsersRouter } from './users.routes';

/**
 * The v1 router. Mounted twice from app.ts:
 *   - /api/v1   (canonical)
 *   - /api      (deprecated alias with Sunset/Deprecation headers)
 */
export function buildV1Router(): Router {
    const router = Router();

    // Best-effort token attachment + tenant resolution for all v1 routes.
    // attachAuth already enters tenant scope when a valid token is present;
    // resolveTenant covers public endpoints that pass X-Tenant-Slug.
    router.use(attachAuth);
    router.use(resolveTenant);

    router.use('/me', buildMeRouter());
    router.use('/users', buildUsersRouter());
    router.use('/devices', buildDevicesRouter());
    router.use('/master', buildMasterRouter());
    router.use('/notifications', buildNotificationsRouter());
    router.use('/cleaners', buildCleanersRouter());
    router.use('/supervisors', buildSupervisorsRouter());
    router.use('/reports', buildReportsRouter());

    return router;
}
