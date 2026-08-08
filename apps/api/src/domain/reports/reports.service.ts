import { ForbiddenError, NotFoundError, ValidationError } from '../../errors';
import { currentTenantId } from '../../infra/tenant-context';
import type { AuthRole } from '../auth/permissions';
import { cleanersRepository, type CleanerRow } from '../cleaners/cleaners.repository';
import { masterRepository } from '../master/master.repository';
import { pushNotificationsService } from '../notifications/push-notifications.service';
import { photosService } from '../photos/photos.service';
import { reportsRepository, type ReportRow } from './reports.repository';
import { usersRepository } from '../users/users.repository';

const STAFF_ROLES: ReadonlyArray<AuthRole> = ['supervisor', 'cleaner', 'master'];
const REPORT_STATUS_REPORTED = 'Reported';
const REPORT_STATUS_PENDING_LEGACY = 'Pending';
const REPORT_STATUS_SUBMITTED_LEGACY = 'Submitted';
const REPORT_STATUS_ASSIGNED = 'Assigned';
const REPORT_STATUS_IN_PROGRESS = 'In Progress';
const REPORT_STATUS_AWAITING_ENDORSEMENT = 'Awaiting Endorsement';
const REPORT_STATUS_RESOLVED = 'Resolved';
const REPORT_STATUS_REJECTED = 'Rejected';

const REPORTED_ALIASES = new Set([
    REPORT_STATUS_REPORTED,
    REPORT_STATUS_PENDING_LEGACY,
    REPORT_STATUS_SUBMITTED_LEGACY
]);
const PENDING_REPORT_STATUSES = new Set([
    REPORT_STATUS_REPORTED,
    REPORT_STATUS_PENDING_LEGACY,
    REPORT_STATUS_SUBMITTED_LEGACY,
    REPORT_STATUS_ASSIGNED
]);
const OPEN_REPORT_STATUSES = new Set([
    REPORT_STATUS_ASSIGNED,
    REPORT_STATUS_IN_PROGRESS,
    REPORT_STATUS_AWAITING_ENDORSEMENT,
    REPORT_STATUS_REJECTED
]);
const URGENT_PRIORITIES = new Set(['High', 'Critical']);

interface LatLng {
    lat: number;
    lng: number;
}

export interface SerializedReport {
    _id: string;
    id: string;                      // legacy "publicId" exposed as `id` for back-compat
    status: string;
    timestamp: Date;
    priority: string;
    category?: string;
    location?: string;
    details?: string;
    coordinates?: unknown;
    reporterPhone?: string;
    userId: string;
    userName?: string;
    reporterName?: string;
    assignedTo?: string;
    assignedToCleanerId?: string;
    assignedBySupervisorId?: string;
    assignedBySupervisorName?: string;
    evidencePhoto?: string;          // presigned GET URL (or legacy data URL)
    photos: string[];                // presigned GET URLs
    resolutionPhoto?: string;        // presigned GET URL
    photoTimestamp?: string;
    resolutionTimestamp?: string;
    resolutionCoordinates?: LatLng;
    resolutionDistanceMeters?: number;
    reviewedAt?: string;
    reviewedBySupervisorId?: string;
    reviewedBySupervisorName?: string;
    reviewNotes?: string;
}

function normalizeCoordinate(value: unknown): LatLng | undefined {
    if (!value || typeof value !== 'object') {
        return undefined;
    }

    const record = value as Record<string, unknown>;
    const lat = typeof record.lat === 'number' ? record.lat : Number(record.lat);
    const lng = typeof record.lng === 'number' ? record.lng : Number(record.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return undefined;
    }

    return { lat, lng };
}

function calculateDistanceMeters(source: LatLng, target: LatLng): number {
    const earthRadiusMeters = 6371000;
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const deltaLat = toRadians(target.lat - source.lat);
    const deltaLng = toRadians(target.lng - source.lng);
    const sourceLat = toRadians(source.lat);
    const targetLat = toRadians(target.lat);

    const a = Math.sin(deltaLat / 2) ** 2 +
        Math.cos(sourceLat) * Math.cos(targetLat) * Math.sin(deltaLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(earthRadiusMeters * c);
}

function isUrgentPriority(priority: string | null | undefined): boolean {
    return Boolean(priority && URGENT_PRIORITIES.has(priority));
}

function normalizeCreatedStatus(value: unknown): string {
    if (typeof value !== 'string' || value.trim() === '') {
        return REPORT_STATUS_REPORTED;
    }

    const trimmed = value.trim();
    return REPORTED_ALIASES.has(trimmed) ? REPORT_STATUS_REPORTED : trimmed;
}

function normalizePublicStatus(value: string): string {
    return REPORTED_ALIASES.has(value) ? REPORT_STATUS_REPORTED : value;
}

async function sendCriticalAdminNotification(
    report: Pick<ReportRow, 'publicId' | 'priority'>,
    input: { type: string; title: string; body: string; data?: Record<string, string> }
): Promise<void> {
    if (!isUrgentPriority(report.priority)) {
        return;
    }

    const masters = await masterRepository.listAll();
    await pushNotificationsService.sendToRecipients({
        masterUserIds: masters.map((master) => master.id),
        reportId: report.publicId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data,
        isCritical: true
    });
}

async function resolveAssignedCleanerUserId(cleanerRosterId: string | null | undefined): Promise<string | undefined> {
    if (!cleanerRosterId) {
        return undefined;
    }

    const cleaner = await cleanersRepository.findById(cleanerRosterId);
    if (!cleaner) {
        return undefined;
    }

    const account = await usersRepository.findByIdNumber(cleaner.workId);
    return account?.id;
}

function resolveNextStatus(
    existing: ReportRow,
    requestedStatus: string | undefined,
    actor?: { role: AuthRole; userId: string; name: string }
): string | undefined {
    if (!requestedStatus || !actor) {
        return requestedStatus;
    }

    if (actor.role === 'cleaner' && requestedStatus === REPORT_STATUS_RESOLVED) {
        return REPORT_STATUS_AWAITING_ENDORSEMENT;
    }

    if (requestedStatus === REPORT_STATUS_REJECTED && actor.role === 'cleaner') {
        throw new ForbiddenError('Cleaners cannot reject report outcomes.');
    }

    if (requestedStatus === REPORT_STATUS_RESOLVED || requestedStatus === REPORT_STATUS_REJECTED) {
        if (actor.role === 'cleaner') {
            throw new ForbiddenError('Supervisor endorsement is required before a cleaner task can be completed.');
        }

        if (
            requestedStatus === REPORT_STATUS_REJECTED &&
            existing.status !== REPORT_STATUS_AWAITING_ENDORSEMENT &&
            existing.status !== REPORT_STATUS_REJECTED
        ) {
            throw new ValidationError('Only resolutions awaiting endorsement can be rejected.');
        }
    }

    return requestedStatus;
}

export async function serializeReport(row: ReportRow): Promise<SerializedReport> {
    const [evidencePhoto, photos, resolutionPhoto] = await Promise.all([
        photosService.resolvePhotoString(row.evidencePhoto),
        photosService.resolvePhotoArray(row.photos as unknown),
        photosService.resolvePhotoString(row.resolutionPhoto)
    ]);
    const resolutionCoordinates = normalizeCoordinate(row.resolutionCoordinates);

    return {
        _id: row.id,
        id: row.publicId,
        status: row.status,
        timestamp: row.timestamp,
        priority: row.priority,
        category: row.category ?? undefined,
        location: row.location ?? undefined,
        details: row.details ?? undefined,
        coordinates: row.coordinates ?? undefined,
        reporterPhone: row.reporterPhone ?? undefined,
        userId: row.userId,
        userName: row.userName ?? undefined,
        reporterName: row.userName ?? undefined,
        assignedTo: row.assignedTo ?? undefined,
        assignedToCleanerId: row.assignedToCleanerId ?? undefined,
        assignedBySupervisorId: row.assignedBySupervisorId ?? undefined,
        assignedBySupervisorName: row.assignedBySupervisorName ?? undefined,
        evidencePhoto: evidencePhoto ?? undefined,
        photos,
        resolutionPhoto: resolutionPhoto ?? undefined,
        photoTimestamp: row.photoTimestamp ?? undefined,
        resolutionTimestamp: row.resolutionTimestamp ?? undefined,
        resolutionCoordinates,
        resolutionDistanceMeters: row.resolutionDistanceMeters ?? undefined,
        reviewedAt: row.reviewedAt ?? undefined,
        reviewedBySupervisorId: row.reviewedBySupervisorId ?? undefined,
        reviewedBySupervisorName: row.reviewedBySupervisorName ?? undefined,
        reviewNotes: row.reviewNotes ?? undefined
    };
}

async function serializeMany(rows: ReportRow[]): Promise<SerializedReport[]> {
    return Promise.all(rows.map(serializeReport));
}

export interface PublicStatusReport {
    _id: string;
    id: string;
    status: string;
    timestamp: Date;
    priority: string;
    category?: string;
    location?: string;
    details?: string;
    assignedTo?: string;
    resolutionTimestamp?: string;
}

export interface PublicStatusCleaner {
    _id: string;
    name: string;
    workLocation?: string;
    status: 'Busy' | 'Free';
    assignedTaskId?: string;
}

export interface PublicStatusSummary {
    total: number;
    open: number;
    pending: number;
    resolved: number;
    urgent: number;
    cleaners: number;
    availableCleaners: number;
    busyCleaners: number;
}

export interface PublicStatusBoard {
    generatedAt: string;
    summary: PublicStatusSummary;
    reports: PublicStatusReport[];
    cleaners: PublicStatusCleaner[];
}

function serializePublicStatusReport(row: ReportRow): PublicStatusReport {
    return {
        _id: row.id,
        id: row.publicId,
        status: normalizePublicStatus(row.status),
        timestamp: row.timestamp,
        priority: row.priority,
        category: row.category ?? undefined,
        location: row.location ?? undefined,
        details: row.details ?? undefined,
        assignedTo: row.assignedTo ?? undefined,
        resolutionTimestamp: row.resolutionTimestamp ?? undefined
    };
}

function serializePublicStatusCleaner(row: CleanerRow, now = new Date()): PublicStatusCleaner {
    const busyUntilDate = row.busyUntil ? new Date(row.busyUntil) : null;
    const isBusy = Boolean(row.assignedTaskId);

    return {
        _id: row.id,
        name: row.name,
        workLocation: row.workLocation ?? undefined,
        status: isBusy ? 'Busy' : 'Free',
        assignedTaskId: row.assignedTaskId ?? undefined
    };
}

function buildPublicStatusSummary(
    reports: PublicStatusReport[],
    cleaners: PublicStatusCleaner[]
): PublicStatusSummary {
    const resolved = reports.filter((report) => report.status === 'Resolved').length;
    const pending = reports.filter((report) => PENDING_REPORT_STATUSES.has(report.status)).length;
    const open = reports.filter((report) => OPEN_REPORT_STATUSES.has(report.status)).length;
    const urgent = reports.filter(
        (report) => report.status !== 'Resolved' && URGENT_PRIORITIES.has(report.priority)
    ).length;
    const busyCleaners = cleaners.filter((cleaner) => cleaner.status === 'Busy').length;

    return {
        total: reports.length,
        open,
        pending,
        resolved,
        urgent,
        cleaners: cleaners.length,
        availableCleaners: cleaners.length - busyCleaners,
        busyCleaners
    };
}

export interface ReportInput {
    [key: string]: unknown;
    id?: string;
    evidencePhoto?: string;
    photos?: Array<{ dataUrl?: string }>;
}

export const reportsService = {
    async list(actor: { role: AuthRole; userId: string; name: string }): Promise<SerializedReport[]> {
        if (actor.role === 'cleaner') {
            const cleanerAccount = await usersRepository.findById(actor.userId);
            if (!cleanerAccount) {
                return [];
            }

            // Find every roster row plausibly linked to this user. We match by
            // workId == idNumber (case-insensitive trim) OR roster name == user
            // name. This survives data drift between UserAccount.idNumber and
            // Cleaner.workId, and between the user-facing name and the roster
            // name supervisors picked when assigning a task.
            const linkedCleaners = await cleanersRepository.findAllForUser({
                idNumber: cleanerAccount.idNumber,
                name: cleanerAccount.name
            });

            const cleanerIds = Array.from(new Set(linkedCleaners.map((c) => c.id)));
            const cleanerNames = Array.from(
                new Set(
                    [cleanerAccount.name, ...linkedCleaners.map((c) => c.name)]
                        .map((n) => n?.trim())
                        .filter((n): n is string => Boolean(n && n.length > 0))
                )
            );

            const rows = await reportsRepository.list({
                cleanerIds,
                cleanerNames
            });
            return serializeMany(rows);
        }

        // Public users can only see their own reports
        if (actor.role === 'public') {
            const rows = await reportsRepository.list({ userId: actor.userId });
            return serializeMany(rows);
        }

        // Supervisors and masters can see all reports
        const rows = await reportsRepository.list({});
        return serializeMany(rows);
    },

    async getPublicStatusBoard(): Promise<PublicStatusBoard> {
        const [reportRows, cleanerRows] = await Promise.all([
            reportsRepository.list({}),
            cleanersRepository.list({}).catch(() => [])
        ]);
        const now = new Date();
        const reports = reportRows.map(serializePublicStatusReport);
        const cleaners = cleanerRows.map((row) => serializePublicStatusCleaner(row, now));

        return {
            generatedAt: now.toISOString(),
            summary: buildPublicStatusSummary(reports, cleaners),
            reports,
            cleaners
        };
    },

    async listForUser(userId: string): Promise<SerializedReport[]> {
        const rows = await reportsRepository.list({ userId });
        return serializeMany(rows);
    },

    async getById(reportPublicId: string, actor: { role: AuthRole; userId: string }): Promise<SerializedReport> {
        const report = await reportsRepository.findByPublicId(reportPublicId);
        if (!report) {
            throw new NotFoundError('Report not found');
        }

        const isStaff = (STAFF_ROLES as ReadonlyArray<string>).includes(actor.role);
        if (!isStaff && report.userId !== actor.userId) {
            throw new ForbiddenError('You do not have access to this report');
        }

        return serializeReport(report);
    },

    async create(actor: { role: AuthRole; userId: string; name: string }, body: ReportInput): Promise<SerializedReport> {
        if (actor.role === 'master') {
            throw new ForbiddenError('Master users cannot create public reports');
        }

        const tenantId = currentTenantId();
        if (!tenantId) {
            throw new ForbiddenError('Tenant context is required');
        }

        const reportId = await reportsRepository.nextPublicId(tenantId);

        const evidenceCandidate = typeof body.evidencePhoto === 'string'
            ? body.evidencePhoto
            : (Array.isArray(body.photos) && body.photos.length > 0
                ? body.photos[0]?.dataUrl ?? undefined
                : undefined);

        const evidenceKey = await photosService.ingestPhotoString(evidenceCandidate, {
            reportId,
            kind: 'evidence'
        });

        const photoKeys = await photosService.ingestPhotoArray(body.photos, {
            reportId,
            kind: 'extra'
        });

        const created = await reportsRepository.create({
            publicId: reportId,
            userId: actor.userId,
            userName: actor.name,
            status: normalizeCreatedStatus(body.status),
            priority: typeof body.priority === 'string' ? body.priority : undefined,
            category: typeof body.category === 'string' ? body.category : undefined,
            location: typeof body.location === 'string' ? body.location : undefined,
            details: typeof body.details === 'string' ? body.details : undefined,
            coordinates: body.coordinates,
            reporterPhone: typeof body.reporterPhone === 'string' ? body.reporterPhone : undefined,
            evidencePhoto: evidenceKey ?? undefined,
            photos: photoKeys,
            photoTimestamp: typeof body.photoTimestamp === 'string' ? body.photoTimestamp : undefined
        });

        if (actor.role === 'public') {
            const supervisors = await usersRepository.listByRoles(['supervisor']);
            await pushNotificationsService.sendToRecipients({
                userIds: supervisors.map((user) => user.id),
                reportId: created.publicId,
                type: 'report_created',
                title: 'New report submitted',
                body: `${created.userName ?? 'A reporter'} reported ${created.category ?? 'an issue'} at ${created.location ?? 'the reported location'}.`,
                data: {
                    category: created.category ?? '',
                    location: created.location ?? ''
                }
            });
            await sendCriticalAdminNotification(created, {
                type: 'critical_report_created',
                title: 'Critical report submitted',
                body: `${created.userName ?? 'A reporter'} submitted ${created.priority ?? 'an urgent'} report ${created.publicId}.`,
                data: {
                    category: created.category ?? '',
                    location: created.location ?? ''
                }
            });
        }

        return serializeReport(created);
    },

    async update(
        reportPublicId: string,
        patch: Record<string, unknown>,
        actor?: { role: AuthRole; userId: string; name: string }
    ): Promise<SerializedReport> {
        const existing = await reportsRepository.findByPublicId(reportPublicId);
        if (!existing) {
            throw new NotFoundError('Report not found');
        }

        const requestedStatus = typeof patch.status === 'string' ? patch.status : undefined;
        const nextStatus = resolveNextStatus(existing, requestedStatus, actor);
        if (nextStatus) {
            patch.status = nextStatus;
        }

        if ('resolutionCoordinates' in patch) {
            const resolutionCoordinates = normalizeCoordinate(patch.resolutionCoordinates);
            if (!resolutionCoordinates) {
                throw new ValidationError('resolutionCoordinates must include numeric lat and lng values.');
            }
            patch.resolutionCoordinates = resolutionCoordinates;

            const originalCoordinates = normalizeCoordinate(existing.coordinates);
            patch.resolutionDistanceMeters = originalCoordinates
                ? calculateDistanceMeters(originalCoordinates, resolutionCoordinates)
                : null;
        }

        if (patch.status === REPORT_STATUS_AWAITING_ENDORSEMENT) {
            patch.reviewedAt = null;
            patch.reviewedBySupervisorId = null;
            patch.reviewedBySupervisorName = null;
            patch.reviewNotes = null;
        }

        if (patch.status === REPORT_STATUS_RESOLVED || patch.status === REPORT_STATUS_REJECTED) {
            patch.reviewedAt = new Date().toISOString();
            patch.reviewedBySupervisorId = actor?.userId ?? null;
            patch.reviewedBySupervisorName = actor?.name ?? null;
        }

        const shouldClearAssignment = patch.status === REPORT_STATUS_RESOLVED;
        if (shouldClearAssignment) {
            await cleanersRepository.clearAssignmentByTaskId(existing.publicId);
        }

        // Absorb any base64 data URLs in the patch into object storage so we
        // never persist data URLs into Postgres rows.
        if (typeof patch.evidencePhoto === 'string') {
            patch.evidencePhoto = await photosService.ingestPhotoString(patch.evidencePhoto, {
                reportId: reportPublicId,
                kind: 'evidence'
            });
        }
        if (typeof patch.resolutionPhoto === 'string') {
            patch.resolutionPhoto = await photosService.ingestPhotoString(patch.resolutionPhoto, {
                reportId: reportPublicId,
                kind: 'resolution'
            });
        }
        if (Array.isArray(patch.photos)) {
            patch.photos = await photosService.ingestPhotoArray(patch.photos, {
                reportId: reportPublicId,
                kind: 'extra'
            });
        }

        const updated = await reportsRepository.update(reportPublicId, patch);
        if (!updated) {
            throw new NotFoundError('Report not found');
        }

        if (patch.status === REPORT_STATUS_AWAITING_ENDORSEMENT && existing.assignedBySupervisorId) {
            await pushNotificationsService.sendToRecipients({
                userIds: [existing.assignedBySupervisorId],
                reportId: updated.publicId,
                type: 'report_pending_endorsement',
                title: 'Resolution ready for review',
                body: `${updated.assignedTo ?? actor?.name ?? 'Cleaner'} submitted report ${updated.publicId} for supervisor endorsement.`,
                data: {
                    location: updated.location ?? ''
                }
            });
            await sendCriticalAdminNotification(updated, {
                type: 'critical_report_pending_endorsement',
                title: 'Critical resolution awaiting endorsement',
                body: `Critical report ${updated.publicId} is awaiting supervisor endorsement.`,
                data: {
                    location: updated.location ?? ''
                }
            });
        }

        if (patch.status === REPORT_STATUS_RESOLVED) {
            const cleanerUserId = await resolveAssignedCleanerUserId(existing.assignedToCleanerId);
            const resolvedUserIds = [updated.userId, ...(cleanerUserId ? [cleanerUserId] : [])];
            if (existing.assignedBySupervisorId) {
                await pushNotificationsService.sendToRecipients({
                    userIds: [existing.assignedBySupervisorId],
                    reportId: updated.publicId,
                    type: 'report_endorsed_supervisor',
                    title: 'Resolution endorsed',
                    body: `Report ${updated.publicId} has been endorsed and marked complete.`,
                    data: {
                        location: updated.location ?? ''
                    }
                });
            }

            await pushNotificationsService.sendToRecipients({
                userIds: resolvedUserIds,
                reportId: updated.publicId,
                type: 'report_resolved_reporter',
                title: 'Issue resolved',
                body: `Your report ${updated.publicId} at ${updated.location ?? 'the reported location'} has been resolved.`,
                data: {
                    location: updated.location ?? ''
                }
            });
            await sendCriticalAdminNotification(updated, {
                type: 'critical_report_resolved',
                title: 'Critical report resolved',
                body: `Critical report ${updated.publicId} has been endorsed and completed.`,
                data: {
                    location: updated.location ?? ''
                }
            });
        }

        if (patch.status === REPORT_STATUS_REJECTED) {
            const cleanerUserId = await resolveAssignedCleanerUserId(existing.assignedToCleanerId);
            const reviewNotes = typeof patch.reviewNotes === 'string' ? patch.reviewNotes.trim() : '';
            const rejectedUserIds = [
                ...(cleanerUserId ? [cleanerUserId] : []),
                updated.userId,
                ...(existing.assignedBySupervisorId ? [existing.assignedBySupervisorId] : [])
            ];
            await pushNotificationsService.sendToRecipients({
                userIds: rejectedUserIds,
                reportId: updated.publicId,
                type: 'report_rejected',
                title: 'Resolution needs follow-up',
                body: reviewNotes || `Report ${updated.publicId} requires additional work before it can be endorsed.`,
                data: {
                    location: updated.location ?? ''
                }
            });
            await sendCriticalAdminNotification(updated, {
                type: 'critical_report_rejected',
                title: 'Critical resolution rejected',
                body: `Critical report ${updated.publicId} was rejected during supervisor review.`,
                data: {
                    location: updated.location ?? ''
                }
            });
        }

        return serializeReport(updated);
    },

    /**
     * Attach a directly-uploaded photo (key returned from a presign call) to
     * an existing report. `kind` decides which column the key lands in.
     */
    async attachPhotoKey(
        reportPublicId: string,
        opts: { key: string; kind: 'evidence' | 'resolution' | 'extra'; timestamp?: string }
    ): Promise<SerializedReport> {
        const existing = await reportsRepository.findByPublicId(reportPublicId);
        if (!existing) {
            throw new NotFoundError('Report not found');
        }

        const patch: Record<string, unknown> = {};
        if (opts.kind === 'evidence') {
            patch.evidencePhoto = opts.key;
            if (opts.timestamp) patch.photoTimestamp = opts.timestamp;
        } else if (opts.kind === 'resolution') {
            patch.resolutionPhoto = opts.key;
            if (opts.timestamp) patch.resolutionTimestamp = opts.timestamp;
        } else {
            const current = Array.isArray(existing.photos) ? (existing.photos as unknown[]) : [];
            patch.photos = [...current, opts.key];
        }

        const updated = await reportsRepository.update(reportPublicId, patch);
        if (!updated) {
            throw new NotFoundError('Report not found');
        }
        return serializeReport(updated);
    }
};
