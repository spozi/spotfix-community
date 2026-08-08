import { Router } from 'express';

import { resolveTenant } from '../../../http/middleware/tenant';
import { v2ErrorHandler, v2NotFoundHandler } from '../error.middleware';
import { buildAuthV2Router, buildMeV2Router } from './auth.routes';
import { buildAdminV2Router } from './admin.routes';
import { buildCleanerV2Router } from './cleaner.routes';
import { buildDevicesV2Router } from './devices.routes';
import { buildGeoV2Router } from './geo.routes';
import { buildMonitorV2Router } from './monitor.routes';
import { buildReportsV2Router } from './reports.routes';
import { buildSupervisorV2Router } from './supervisor.routes';
import { buildNotificationsV2Router, buildSyncV2Router } from './sync.routes';
import { buildUploadsV2Router } from './uploads.routes';

/**
 * /api/v2 router. Uses its own error/notFound middleware so v2 responds with
 * the v2 envelope (`{ success, ... }` / `{ success: false, error: {...} }`)
 * even on framework-level errors.
 */
export function buildV2Router(): Router {
    const router = Router();

    // Tenant resolution from X-Tenant-Slug header (or env default).
    // v2 auth is request-scoped; no global attachAuth here — each route opts
    // into requireV2Auth as needed.
    router.use(resolveTenant);

    router.get('/', (_req, res) => {
        res.json({
            success: true,
            data: {
                name: 'SpotFix Community API',
                version: 'v2',
                supportedVersions: ['v1', 'v2']
            }
        });
    });

    router.use('/devices', buildDevicesV2Router());
    router.use('/auth', buildAuthV2Router());
    router.use('/me', buildMeV2Router());
    router.use('/admin', buildAdminV2Router());
    router.use('/reports', buildReportsV2Router());
    router.use('/supervisor', buildSupervisorV2Router());
    router.use('/cleaner', buildCleanerV2Router());
    router.use('/sync', buildSyncV2Router());
    router.use('/notifications', buildNotificationsV2Router());
    router.use('/uploads', buildUploadsV2Router());
    router.use('/geo', buildGeoV2Router());
    // Public, cross-tenant, read-only monitoring surface (web dashboard).
    router.use('/monitor', buildMonitorV2Router());

    router.use(v2NotFoundHandler);
    router.use(v2ErrorHandler);

    return router;
}
