/**
 * v2 geo service — campus boundary + landmark association.
 *
 * Features:
 *   - `getGeoConfig()`   — tenant campus center/zoom/boundary polygon, used by
 *                          Android for the local outside-campus check and by
 *                          the map screens for initial camera position.
 *   - `resolveLocation()`— GPS point -> { insideCampus, nearest landmark,
 *                          suggested address }. Used by the Android composer
 *                          to prefill the address, and by `createReport` to
 *                          auto-fill `locationAddress` server-side.
 *
 * Pure-math helpers (`pointInRing`, `haversineMeters`) are exported for tests.
 */
import { prisma } from '../../infra/prisma';

// Landmarks farther than this are never associated, regardless of radius.
const MAX_ASSOCIATION_DISTANCE_M = 400;

export interface GeoConfig {
    displayName: string;
    centerLat: number;
    centerLng: number;
    defaultZoom: number;
    /** Open polygon ring, [lng, lat] pairs. Empty when unconfigured. */
    boundary: Array<[number, number]>;
}

export interface ResolvedLocation {
    insideCampus: boolean | null; // null when no boundary configured
    landmark: {
        id: string;
        name: string;
        category: string;
        distanceM: number;
    } | null;
    suggestedAddress: string | null;
}

/** Ray-casting point-in-polygon. Ring is [lng, lat] pairs, open or closed. */
export function pointInRing(lat: number, lng: number, ring: Array<[number, number]>): boolean {
    if (ring.length < 3) return false;
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const current = ring[i];
        const previous = ring[j];
        if (!current || !previous) continue;
        const [xi, yi] = current; // lng, lat
        const [xj, yj] = previous;
        const intersects =
            yi > lat !== yj > lat &&
            lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
        if (intersects) inside = !inside;
    }
    return inside;
}

/** Great-circle distance in meters. */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

function parseBoundary(value: unknown): Array<[number, number]> {
    if (!Array.isArray(value)) return [];
    const ring: Array<[number, number]> = [];
    for (const entry of value) {
        if (
            Array.isArray(entry) &&
            entry.length >= 2 &&
            typeof entry[0] === 'number' &&
            typeof entry[1] === 'number'
        ) {
            ring.push([entry[0], entry[1]]);
        }
    }
    return ring;
}

/** Tenant-scoped geo config, or null when the tenant has none configured. */
export async function getGeoConfig(): Promise<GeoConfig | null> {
    const row = await prisma.tenantGeoV2.findFirst({});
    if (!row) return null;
    return {
        displayName: row.displayName,
        centerLat: row.centerLat,
        centerLng: row.centerLng,
        defaultZoom: row.defaultZoom,
        boundary: parseBoundary(row.boundary)
    };
}

/**
 * Associate a GPS point with the tenant campus: inside/outside the boundary
 * and the nearest landmark within its association radius.
 */
export async function resolveLocation(lat: number, lng: number): Promise<ResolvedLocation> {
    const [config, landmarks] = await Promise.all([
        getGeoConfig(),
        prisma.campusLandmarkV2.findMany({})
    ]);

    const insideCampus =
        config && config.boundary.length >= 3 ? pointInRing(lat, lng, config.boundary) : null;

    let best: { id: string; name: string; category: string; distanceM: number } | null = null;
    for (const lm of landmarks) {
        const distance = haversineMeters(lat, lng, lm.lat, lm.lng);
        if (distance > Math.min(lm.radiusM, MAX_ASSOCIATION_DISTANCE_M)) continue;
        if (!best || distance < best.distanceM) {
            best = {
                id: lm.id,
                name: lm.name,
                category: lm.category,
                distanceM: Math.round(distance)
            };
        }
    }

    const campusName = config?.displayName ?? null;
    const suggestedAddress = best
        ? campusName
            ? `${best.name}, ${campusName}`
            : best.name
        : insideCampus && campusName
            ? campusName
            : null;

    return { insideCampus, landmark: best, suggestedAddress };
}
