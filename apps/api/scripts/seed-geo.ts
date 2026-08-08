/**
 * scripts/seed-geo.ts
 *
 * Seeds per-tenant geo config (campus boundary + center) and a starter list of
 * campus landmarks for the v2 geo features:
 *   - outside-campus warning on report creation
 *   - automatic landmark / address association from GPS
 *   - public monitoring dashboard (organizations map)
 *
 * Idempotent: uses upserts keyed on tenant slug / landmark name — safe to
 * re-run any time. Coordinates are APPROXIMATE starter values; refine them by
 * editing this file (or the DB rows) as surveyed data becomes available.
 *
 * Usage:
 *   npm run seed:geo
 */
import { prismaRaw } from '../src/infra/prisma';

interface LandmarkSeed {
    name: string;
    category: 'building' | 'residence' | 'facility' | 'landmark';
    lat: number;
    lng: number;
    radiusM?: number;
}

interface OrgSeed {
    slug: string;
    tenantName: string;
    displayName: string;
    centerLat: number;
    centerLng: number;
    defaultZoom: number;
    /** Open polygon ring, [lng, lat] pairs (GeoJSON coordinate order). */
    boundary: Array<[number, number]>;
    landmarks: LandmarkSeed[];
}

const ORGS: OrgSeed[] = [
    {
        slug: process.env.BOOTSTRAP_TENANT_SLUG?.trim() || 'example-campus',
        tenantName: 'Example Campus Facilities',
        displayName: 'Example Campus',
        centerLat: 3.139,
        centerLng: 101.6869,
        defaultZoom: 15,
        // Fictional starter boundary — replace it with surveyed deployment data.
        boundary: [
            [101.681, 3.134],
            [101.692, 3.134],
            [101.692, 3.144],
            [101.681, 3.144]
        ],
        landmarks: [
            { name: 'Main Library', category: 'building', lat: 3.14, lng: 101.687 },
            { name: 'Administration Building', category: 'building', lat: 3.1425, lng: 101.6874 },
            { name: 'Sports Centre', category: 'facility', lat: 3.137, lng: 101.684, radiusM: 300 },
            { name: 'Student Residence', category: 'residence', lat: 3.136, lng: 101.689, radiusM: 300 },
            { name: 'Main Entrance', category: 'landmark', lat: 3.1345, lng: 101.686 }
        ]
    }
];

async function seedOrg(org: OrgSeed): Promise<void> {
    const tenant = await prismaRaw.tenant.upsert({
        where: { slug: org.slug },
        update: {},
        create: { slug: org.slug, name: org.tenantName }
    });

    await prismaRaw.tenantGeoV2.upsert({
        where: { tenantId: tenant.id },
        update: {
            displayName: org.displayName,
            centerLat: org.centerLat,
            centerLng: org.centerLng,
            defaultZoom: org.defaultZoom,
            boundary: org.boundary
        },
        create: {
            tenantId: tenant.id,
            displayName: org.displayName,
            centerLat: org.centerLat,
            centerLng: org.centerLng,
            defaultZoom: org.defaultZoom,
            boundary: org.boundary
        }
    });

    for (const lm of org.landmarks) {
        await prismaRaw.campusLandmarkV2.upsert({
            where: { tenantId_name: { tenantId: tenant.id, name: lm.name } },
            update: {
                category: lm.category,
                lat: lm.lat,
                lng: lm.lng,
                radiusM: lm.radiusM ?? 200
            },
            create: {
                tenantId: tenant.id,
                name: lm.name,
                category: lm.category,
                lat: lm.lat,
                lng: lm.lng,
                radiusM: lm.radiusM ?? 200
            }
        });
    }

    console.log(
        `seed-geo: ${org.slug} — geo config + ${org.landmarks.length} landmarks upserted`
    );
}

async function main(): Promise<void> {
    for (const org of ORGS) {
        await seedOrg(org);
    }
}

main()
    .then(async () => {
        await prismaRaw.$disconnect();
    })
    .catch(async (err) => {
        console.error('seed-geo failed:', err);
        await prismaRaw.$disconnect();
        process.exit(1);
    });
