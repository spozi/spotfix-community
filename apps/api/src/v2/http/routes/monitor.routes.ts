import { Router } from 'express';

import { asyncHandler } from '../../../http/asyncHandler';
import { V2NotFoundError } from '../../errors';
import {
    getOrgOverview,
    listOrgReports,
    listOrgs,
    type MonitorOrgSummary,
    type MonitorReport
} from '../../monitor/monitor.service';
import { ok } from '../envelope';
import { MonitorReportsQuerySchema } from '../schemas';
import { validateV2 } from '../validate';

function serializeOrg(org: MonitorOrgSummary) {
    return {
        slug: org.slug,
        name: org.name,
        display_name: org.displayName,
        center_lat: org.centerLat,
        center_lng: org.centerLng,
        default_zoom: org.defaultZoom,
        stats: {
            total: org.stats.total,
            open: org.stats.open,
            awaiting_review: org.stats.awaitingReview,
            resolved: org.stats.resolved,
            resolved_last_7_days: org.stats.resolvedLast7Days
        }
    };
}

function serializeMonitorReport(report: MonitorReport) {
    return {
        id: report.id,
        title: report.title,
        status: report.status,
        priority: report.priority,
        location_lat: report.locationLat,
        location_lng: report.locationLng,
        location_address: report.locationAddress,
        created_at: report.createdAt.toISOString(),
        updated_at: report.updatedAt.toISOString()
    };
}

/**
 * /api/v2/monitor — public, read-only, cross-tenant monitoring surface for
 * the web dashboard. No auth, no tenant header; responses are anonymized
 * (no reporter identity, attachments, or event payloads).
 */
export function buildMonitorV2Router(): Router {
    const router = Router();

    // GET /api/v2/monitor/orgs
    router.get(
        '/orgs',
        asyncHandler(async (_req, res) => {
            const orgs = await listOrgs();
            ok(res, { orgs: orgs.map(serializeOrg) });
        })
    );

    // GET /api/v2/monitor/orgs/:slug/overview
    router.get(
        '/orgs/:slug/overview',
        asyncHandler(async (req, res) => {
            const overview = await getOrgOverview(String(req.params.slug));
            if (!overview) throw new V2NotFoundError('Organization not found.');
            ok(res, {
                org: serializeOrg(overview.org),
                boundary: overview.boundary,
                landmarks: overview.landmarks.map((lm) => ({
                    name: lm.name,
                    category: lm.category,
                    lat: lm.lat,
                    lng: lm.lng
                })),
                status_summary: overview.statusSummary
            });
        })
    );

    // GET /api/v2/monitor/orgs/:slug/reports?status=&limit=
    router.get(
        '/orgs/:slug/reports',
        validateV2(MonitorReportsQuerySchema, 'query'),
        asyncHandler(async (req, res) => {
            const q = req.query as unknown as { status?: string; limit?: number };
            const reports = await listOrgReports(String(req.params.slug), {
                status: q.status,
                limit: q.limit
            });
            if (!reports) throw new V2NotFoundError('Organization not found.');
            ok(res, { reports: reports.map(serializeMonitorReport) });
        })
    );

    return router;
}
