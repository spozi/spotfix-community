import { Router } from 'express';

import { asyncHandler } from '../../../http/asyncHandler';
import { requireTenant } from '../../../http/middleware/tenant';
import { getGeoConfig, resolveLocation } from '../../geo/geo.service';
import { ok } from '../envelope';
import { GeoResolveQuerySchema } from '../schemas';
import { validateV2 } from '../validate';

/**
 * /api/v2/geo — tenant campus boundary + landmark association.
 * Tenant-scoped (X-Tenant-Slug or JWT), no auth required: the data is
 * non-sensitive map config and Android needs the boundary before login for
 * the composer's local outside-campus check.
 */
export function buildGeoV2Router(): Router {
    const router = Router();

    // GET /api/v2/geo/config
    router.get(
        '/config',
        requireTenant,
        asyncHandler(async (_req, res) => {
            const config = await getGeoConfig();
            ok(res, {
                configured: config !== null,
                campus: config
                    ? {
                        display_name: config.displayName,
                        center_lat: config.centerLat,
                        center_lng: config.centerLng,
                        default_zoom: config.defaultZoom,
                        boundary: config.boundary
                    }
                    : null
            });
        })
    );

    // GET /api/v2/geo/resolve?lat=&lng=
    router.get(
        '/resolve',
        requireTenant,
        validateV2(GeoResolveQuerySchema, 'query'),
        asyncHandler(async (req, res) => {
            const q = req.query as unknown as { lat: number; lng: number };
            const resolved = await resolveLocation(q.lat, q.lng);
            ok(res, {
                inside_campus: resolved.insideCampus,
                landmark: resolved.landmark
                    ? {
                        id: resolved.landmark.id,
                        name: resolved.landmark.name,
                        category: resolved.landmark.category,
                        distance_m: resolved.landmark.distanceM
                    }
                    : null,
                suggested_address: resolved.suggestedAddress
            });
        })
    );

    return router;
}
