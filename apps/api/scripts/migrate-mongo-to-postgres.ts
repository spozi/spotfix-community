/**
 * scripts/migrate-mongo-to-postgres.ts
 *
 * One-shot ETL: copy legacy MongoDB collections into the Postgres schema for
 * a single target tenant. Idempotent on (tenantId, idNumber/username/publicId).
 *
 * Usage:
 *   MONGO_URI=mongodb://127.0.0.1:27017/spotfix_community \
 *   TARGET_TENANT_SLUG=example-campus \
 *   npm run migrate:mongo
 *
 * Maps:
 *   userkycs       -> UserAccount   (uniqueness: tenantId + idNumber)
 *   masterusers    -> MasterUser    (tenantId + username)
 *   cleaners       -> Cleaner       (no natural key — always insert)
 *   reports        -> Report        (tenantId + publicId  where publicId = legacy `id`)
 *
 * Note: legacy Mongo `_id` ObjectIds are NOT preserved. Cross-document refs
 * stored as strings (e.g. report.userId pointing at userkycs._id) are rewritten
 * to the new cuids using an in-memory id map built during this run.
 */
import { MongoClient } from 'mongodb';

import { prismaRaw } from '../src/infra/prisma';

interface Counts {
    users: number;
    masters: number;
    cleaners: number;
    reports: number;
}

function required(name: string): string {
    const v = process.env[name];
    if (!v || v.trim() === '') throw new Error(`Missing required env: ${name}`);
    return v.trim();
}

async function migrate(): Promise<Counts> {
    const mongoUri = required('MONGO_URI');
    const tenantSlug = required('TARGET_TENANT_SLUG');

    const tenant = await prismaRaw.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
        throw new Error(`Tenant '${tenantSlug}' not found. Run bootstrap first.`);
    }

    const mongo = new MongoClient(mongoUri);
    await mongo.connect();
    const db = mongo.db();
    // eslint-disable-next-line no-console
    console.log(`Connected to Mongo. Target tenant: ${tenant.slug} (${tenant.id})`);

    const counts: Counts = { users: 0, masters: 0, cleaners: 0, reports: 0 };

    // ---- users (userkycs) ----
    const userIdMap = new Map<string, string>();
    const userDocs = await db.collection('userkycs').find({}).toArray();
    for (const doc of userDocs) {
        const idNumber = String(doc.idNumber ?? '');
        if (!idNumber) continue;

        const existing = await prismaRaw.userAccount.findUnique({
            where: { tenantId_idNumber: { tenantId: tenant.id, idNumber } }
        });
        const row = existing ?? await prismaRaw.userAccount.create({
            data: {
                tenantId: tenant.id,
                name: String(doc.name ?? ''),
                idNumber,
                phone: doc.phone ? String(doc.phone) : null,
                passwordHash: String(doc.password ?? ''),
                role: String(doc.role ?? 'public'),
                verified: Boolean(doc.verified ?? true),
                status: String(doc.status ?? 'active'),
                registeredAt: doc.registeredAt ? new Date(doc.registeredAt) : new Date(),
                lastLoginAt: doc.lastLoginAt ? new Date(doc.lastLoginAt) : null,
                loginCount: Number(doc.loginCount ?? 0),
                sessionVersion: Number(doc.sessionVersion ?? 0)
            }
        });
        userIdMap.set(String(doc._id), row.id);
        counts.users++;
    }

    // ---- masters ----
    const masterDocs = await db.collection('masterusers').find({}).toArray();
    for (const doc of masterDocs) {
        const username = String(doc.username ?? '');
        if (!username) continue;
        await prismaRaw.masterUser.upsert({
            where: { tenantId_username: { tenantId: tenant.id, username } },
            update: {},
            create: {
                tenantId: tenant.id,
                username,
                passwordHash: String(doc.password ?? ''),
                name: String(doc.name ?? ''),
                createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
                lastLoginAt: doc.lastLoginAt ? new Date(doc.lastLoginAt) : null,
                sessionVersion: Number(doc.sessionVersion ?? 0)
            }
        });
        counts.masters++;
    }

    // ---- cleaners ----
    const cleanerIdMap = new Map<string, string>();
    const cleanerDocs = await db.collection('cleaners').find({}).toArray();
    for (const doc of cleanerDocs) {
        const supervisorId = doc.supervisorId ? userIdMap.get(String(doc.supervisorId)) ?? null : null;
        const created = await prismaRaw.cleaner.create({
            data: {
                tenantId: tenant.id,
                name: String(doc.name ?? ''),
                workId: String(doc.workId ?? ''),
                phone: doc.phone ? String(doc.phone) : null,
                supervisorId,
                supervisorName: doc.supervisorName ? String(doc.supervisorName) : null,
                assignedTaskId: doc.assignedTaskId ? String(doc.assignedTaskId) : null,
                busyUntil: doc.busyUntil ? new Date(doc.busyUntil) : null
            }
        });
        cleanerIdMap.set(String(doc._id), created.id);
        counts.cleaners++;
    }

    // ---- reports ----
    const reportDocs = await db.collection('reports').find({}).toArray();
    for (const doc of reportDocs) {
        const publicId = String(doc.id ?? doc._id ?? '');
        if (!publicId) continue;

        const remappedUserId = doc.userId ? userIdMap.get(String(doc.userId)) ?? String(doc.userId) : '';
        const remappedCleanerId = doc.assignedToCleanerId
            ? cleanerIdMap.get(String(doc.assignedToCleanerId)) ?? String(doc.assignedToCleanerId)
            : null;
        const remappedSupervisorId = doc.assignedBySupervisorId
            ? userIdMap.get(String(doc.assignedBySupervisorId)) ?? String(doc.assignedBySupervisorId)
            : null;

        await prismaRaw.report.upsert({
            where: { tenantId_publicId: { tenantId: tenant.id, publicId } },
            update: {},
            create: {
                tenantId: tenant.id,
                publicId,
                status: String(doc.status ?? 'Submitted'),
                timestamp: doc.timestamp ? new Date(doc.timestamp) : new Date(),
                priority: String(doc.priority ?? 'Medium'),
                category: doc.category ? String(doc.category) : null,
                location: doc.location ? String(doc.location) : null,
                details: doc.details ? String(doc.details) : null,
                coordinates: (doc.coordinates ?? null) as never,
                reporterPhone: doc.reporterPhone ? String(doc.reporterPhone) : null,
                userId: remappedUserId,
                userName: doc.userName ? String(doc.userName) : null,
                assignedTo: doc.assignedTo ? String(doc.assignedTo) : null,
                assignedToCleanerId: remappedCleanerId,
                assignedBySupervisorId: remappedSupervisorId,
                assignedBySupervisorName: doc.assignedBySupervisorName ? String(doc.assignedBySupervisorName) : null,
                evidencePhoto: doc.evidencePhoto ? String(doc.evidencePhoto) : null,
                photos: (Array.isArray(doc.photos) ? doc.photos : []) as never,
                resolutionPhoto: doc.resolutionPhoto ? String(doc.resolutionPhoto) : null,
                photoTimestamp: doc.photoTimestamp ? String(doc.photoTimestamp) : null,
                resolutionTimestamp: doc.resolutionTimestamp ? String(doc.resolutionTimestamp) : null
            }
        });
        counts.reports++;
    }

    await mongo.close();
    return counts;
}

migrate()
    .then(async (counts) => {
        // eslint-disable-next-line no-console
        console.log('Migration complete:', counts);
        await prismaRaw.$disconnect();
    })
    .catch(async (err) => {
        // eslint-disable-next-line no-console
        console.error('Migration failed:', err);
        await prismaRaw.$disconnect();
        process.exit(1);
    });
