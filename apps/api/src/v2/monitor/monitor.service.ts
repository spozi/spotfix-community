/**
 * v2 monitor service — PUBLIC, READ-ONLY, CROSS-TENANT.
 *
 * Powers the web monitoring dashboard: a grid of organizations using the
 * system and, per organization, the campus map with report
 * markers + status summaries.
 *
 * This module intentionally uses `prismaRaw`: the tenant-scoped client cannot
 * express "aggregate across every active tenant". Safety rules applied here
 * instead:
 *   - every query filters by an explicit, validated `tenantId`;
 *   - the surface is read-only (SELECT/aggregate only);
 *   - responses are anonymized — no reporter identity, no attachments,
 *     no event payloads.
 */
import { prismaRaw } from '../../infra/prisma';

const OPEN_STATUSES = [
    'submitted',
    'assigned',
    'accepted_by_cleaner',
    'in_progress',
    'rejected_by_cleaner',
    'rejected_by_supervisor'
];
const AWAITING_REVIEW_STATUSES = ['resolved_by_cleaner'];
const RESOLVED_STATUSES = ['endorsed_by_supervisor', 'closed'];

export interface MonitorOrgSummary {
    slug: string;
    name: string;
    displayName: string | null;
    centerLat: number | null;
    centerLng: number | null;
    defaultZoom: number | null;
    stats: {
        total: number;
        open: number;
        awaitingReview: number;
        resolved: number;
        resolvedLast7Days: number;
    };
}

async function orgStats(tenantId: string) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [total, open, awaitingReview, resolved, resolvedLast7Days] = await Promise.all([
        prismaRaw.reportV2.count({ where: { tenantId } }),
        prismaRaw.reportV2.count({ where: { tenantId, status: { in: OPEN_STATUSES } } }),
        prismaRaw.reportV2.count({ where: { tenantId, status: { in: AWAITING_REVIEW_STATUSES } } }),
        prismaRaw.reportV2.count({ where: { tenantId, status: { in: RESOLVED_STATUSES } } }),
        prismaRaw.reportV2.count({
            where: { tenantId, status: { in: RESOLVED_STATUSES }, updatedAt: { gte: since } }
        })
    ]);
    return { total, open, awaitingReview, resolved, resolvedLast7Days };
}

/** Every active tenant, with its geo config (if any) and headline stats. */
export async function listOrgs(): Promise<MonitorOrgSummary[]> {
    const tenants = await prismaRaw.tenant.findMany({
        where: { status: 'active' },
        select: { id: true, slug: true, name: true, geoV2: true },
        orderBy: { name: 'asc' }
    });

    return Promise.all(
        tenants.map(async (t) => ({
            slug: t.slug,
            name: t.name,
            displayName: t.geoV2?.displayName ?? null,
            centerLat: t.geoV2?.centerLat ?? null,
            centerLng: t.geoV2?.centerLng ?? null,
            defaultZoom: t.geoV2?.defaultZoom ?? null,
            stats: await orgStats(t.id)
        }))
    );
}

async function findActiveTenantBySlug(slug: string) {
    return prismaRaw.tenant.findFirst({
        where: { slug, status: 'active' },
        select: { id: true, slug: true, name: true, geoV2: true }
    });
}

export interface MonitorOrgOverview {
    org: MonitorOrgSummary;
    boundary: unknown;
    landmarks: Array<{ name: string; category: string; lat: number; lng: number }>;
    statusSummary: Record<string, number>;
}

/** Full overview for one organization: geo, landmarks, per-status counts. */
export async function getOrgOverview(slug: string): Promise<MonitorOrgOverview | null> {
    const tenant = await findActiveTenantBySlug(slug);
    if (!tenant) return null;

    const [stats, grouped, landmarks] = await Promise.all([
        orgStats(tenant.id),
        prismaRaw.reportV2.groupBy({
            by: ['status'],
            where: { tenantId: tenant.id },
            _count: { _all: true }
        }),
        prismaRaw.campusLandmarkV2.findMany({
            where: { tenantId: tenant.id },
            select: { name: true, category: true, lat: true, lng: true },
            orderBy: { name: 'asc' }
        })
    ]);

    const statusSummary: Record<string, number> = {};
    for (const row of grouped) statusSummary[row.status] = row._count._all;

    return {
        org: {
            slug: tenant.slug,
            name: tenant.name,
            displayName: tenant.geoV2?.displayName ?? null,
            centerLat: tenant.geoV2?.centerLat ?? null,
            centerLng: tenant.geoV2?.centerLng ?? null,
            defaultZoom: tenant.geoV2?.defaultZoom ?? null,
            stats
        },
        boundary: tenant.geoV2?.boundary ?? [],
        landmarks,
        statusSummary
    };
}

export interface MonitorReport {
    id: string;
    title: string;
    status: string;
    priority: string;
    locationLat: number | null;
    locationLng: number | null;
    locationAddress: string | null;
    createdAt: Date;
    updatedAt: Date;
}

/** Anonymized report list for one organization (map markers + list). */
export async function listOrgReports(
    slug: string,
    args: { status?: string; limit?: number }
): Promise<MonitorReport[] | null> {
    const tenant = await findActiveTenantBySlug(slug);
    if (!tenant) return null;

    const limit = Math.min(500, Math.max(1, args.limit ?? 200));
    const rows = await prismaRaw.reportV2.findMany({
        where: {
            tenantId: tenant.id,
            ...(args.status ? { status: args.status } : {})
        },
        select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            locationLat: true,
            locationLng: true,
            locationAddress: true,
            createdAt: true,
            updatedAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: limit
    });
    return rows;
}
