/**
 * v2 reports service.
 *
 * Implements §10–§12, §17, §18 of android_v2_api_v2.md.
 *
 *   - Status state machine + version-based optimistic concurrency.
 *   - Every mutation creates a ReportEventV2 row (source of truth for sync).
 *   - Every mutation returns { report, event, sync.cursor } per §18.
 *   - Side effect: fan out NotificationV2 rows to the next actor(s).
 */
import { Prisma } from '@prisma/client';
import type { ReportV2, ReportEventV2, ReportAttachmentV2 } from '@prisma/client';

import { pushNotificationsService } from '../../domain/notifications/push-notifications.service';
import { prisma } from '../../infra/prisma';
import { currentTenantId } from '../../infra/tenant-context';
import { resolveLocation } from '../geo/geo.service';
import {
    ReportNotFoundError,
    StaleVersionError,
    V2ConflictError,
    V2NotFoundError,
    V2ValidationError
} from '../errors';
import type { V2AuthContext } from '../auth/v2-auth.service';

// The extended Prisma client surfaces a transaction client whose type is not
// the bare `Prisma.TransactionClient`; derive it from $transaction's callback.
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// ---- Types ---------------------------------------------------------------

export type ReportV2Status =
    | 'submitted'
    | 'assigned'
    | 'accepted_by_cleaner'
    | 'in_progress'
    | 'resolved_by_cleaner'
    | 'endorsed_by_supervisor'
    | 'rejected_by_cleaner'
    | 'rejected_by_supervisor'
    | 'closed'
    | 'cancelled';

export type ReportEventType =
    | 'report_created'
    | 'report_assigned'
    | 'cleaner_accepted_task'
    | 'cleaner_rejected_task'
    | 'cleaner_started_work'
    | 'cleaner_submitted_resolution'
    | 'supervisor_endorsed'
    | 'supervisor_rejected'
    | 'report_closed'
    | 'report_cancelled';

export interface AttachmentInput {
    file_url: string;
    attachment_type: 'report_evidence' | 'cleaner_resolution_evidence' | 'supervisor_review_evidence';
    file_mime_type?: string;
    file_size?: number;
}

export interface CreateReportInput {
    title: string;
    description?: string;
    location_lat?: number;
    location_lng?: number;
    location_address?: string;
    priority?: 'low' | 'medium' | 'high';
    attachments?: AttachmentInput[];
}

export interface MutationResult {
    report: ReportV2;
    event: ReportEventV2;
    cursor: number;
}

interface PostCommitPushNotification {
    userIds: string[];
    reportId: string;
    type: string;
    title: string;
    body: string;
    data?: Record<string, string>;
}

// ---- Helpers -------------------------------------------------------------

function tenantId(): string {
    const t = currentTenantId();
    if (!t) throw new V2ValidationError('Tenant scope is not set.');
    return t;
}

function actorRoleFor(ctx: V2AuthContext, preferred?: 'reporter' | 'supervisor' | 'cleaner' | 'admin'): string {
    if (preferred && ctx.roles[preferred]) return preferred;
    if (ctx.roles.admin) return 'admin';
    if (ctx.roles.supervisor) return 'supervisor';
    if (ctx.roles.cleaner) return 'cleaner';
    return 'reporter';
}

async function createEvent(
    tx: Tx,
    args: {
        reportId: string;
        eventType: ReportEventType;
        actorUserId: string | null;
        actorRole: string;
        payload?: Record<string, unknown>;
    }
): Promise<ReportEventV2> {
    return tx.reportEventV2.create({
        data: {
            tenantId: tenantId(),
            reportId: args.reportId,
            eventType: args.eventType,
            actorUserId: args.actorUserId,
            actorRole: args.actorRole,
            payload: (args.payload ?? {}) as Prisma.InputJsonValue
        } as Prisma.ReportEventV2UncheckedCreateInput
    });
}

async function notifyUsers(
    tx: Tx,
    args: {
        userIds: string[];
        reportId: string;
        eventId: string;
        title: string;
        body: string;
    }
): Promise<void> {
    const userIds = Array.from(new Set(args.userIds.filter(Boolean)));
    if (userIds.length === 0) return;
    const tid = tenantId();
    const rows = userIds.map((userId) => ({
        tenantId: tid,
        userId,
        reportId: args.reportId,
        eventId: args.eventId,
        title: args.title,
        body: args.body
    }));
    await tx.notificationV2.createMany({ data: rows as Prisma.NotificationV2UncheckedCreateInput[] });
}

async function sendStagePushNotifications(notifications: PostCommitPushNotification[]): Promise<void> {
    await Promise.allSettled(
        notifications.map(async (notification) => {
            const userIds = Array.from(new Set(notification.userIds.filter(Boolean)));
            if (userIds.length === 0) return;

            await pushNotificationsService.sendToUsers({
                userIds,
                reportId: notification.reportId,
                type: notification.type,
                title: notification.title,
                body: notification.body,
                data: notification.data
            });
        })
    );
}

/**
 * Resolve every user in the current tenant who has the given role,
 * considering both v2 UserRoleV2 rows and the v1 UserAccount.role column.
 */
async function findUsersWithRole(
    tx: Tx,
    role: 'supervisor' | 'cleaner' | 'admin'
): Promise<string[]> {
    const tid = tenantId();
    const v2 = await tx.userRoleV2.findMany({
        where: { tenantId: tid, role },
        select: { userId: true }
    });
    // v1 column lift — `public` users are reporters; supervisor/cleaner mirror v1.
    const v1 = await tx.userAccount.findMany({
        where: { tenantId: tid, role },
        select: { id: true }
    });
    const set = new Set<string>([...v2.map((r) => r.userId), ...v1.map((r) => r.id)]);
    return Array.from(set);
}

// ---- Reads ---------------------------------------------------------------

export async function getReportByIdForActor(
    reportId: string,
    ctx: V2AuthContext
): Promise<{ report: ReportV2; attachments: ReportAttachmentV2[]; events: ReportEventV2[] }> {
    const report = await prisma.reportV2.findFirst({ where: { id: reportId } });
    if (!report) throw new ReportNotFoundError();

    const isReporter = report.reporterUserId === ctx.userId;
    const isAssignedSupervisor = report.assignedSupervisorId === ctx.userId;
    const isAssignedCleaner = report.assignedCleanerId === ctx.userId;
    const canSee =
        isReporter ||
        isAssignedSupervisor ||
        isAssignedCleaner ||
        ctx.roles.supervisor ||
        ctx.roles.admin;
    if (!canSee) throw new ReportNotFoundError();

    const [attachments, events] = await Promise.all([
        prisma.reportAttachmentV2.findMany({
            where: { reportId },
            orderBy: { createdAt: 'asc' }
        }),
        prisma.reportEventV2.findMany({
            where: { reportId },
            orderBy: { createdAt: 'asc' }
        })
    ]);
    return { report, attachments, events };
}

export async function listMyReports(
    ctx: V2AuthContext,
    args: { page?: number; limit?: number } = {}
): Promise<{ reports: ReportV2[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, args.page ?? 1);
    const limit = Math.min(100, Math.max(1, args.limit ?? 100));
    const where: Prisma.ReportV2WhereInput = { reporterUserId: ctx.userId };
    const [reports, total] = await Promise.all([
        prisma.reportV2.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit
        }),
        prisma.reportV2.count({ where })
    ]);
    return { reports, total, page, limit };
}

export async function supervisorList(args: {
    status?: ReportV2Status;
    page?: number;
    limit?: number;
}): Promise<{ reports: ReportV2[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, args.page ?? 1);
    const limit = Math.min(100, Math.max(1, args.limit ?? 20));
    const where: Prisma.ReportV2WhereInput = {};
    if (args.status) where.status = args.status;
    const [reports, total] = await Promise.all([
        prisma.reportV2.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit
        }),
        prisma.reportV2.count({ where })
    ]);
    return { reports, total, page, limit };
}

export async function supervisorDashboard(): Promise<{
    summary: Record<ReportV2Status, number>;
    recent: ReportV2[];
}> {
    const grouped = await prisma.reportV2.groupBy({
        by: ['status'],
        _count: { _all: true }
    });
    const summary: Record<string, number> = {
        submitted: 0,
        assigned: 0,
        accepted_by_cleaner: 0,
        in_progress: 0,
        resolved_by_cleaner: 0,
        endorsed_by_supervisor: 0,
        rejected_by_cleaner: 0,
        rejected_by_supervisor: 0,
        closed: 0,
        cancelled: 0
    };
    for (const row of grouped) summary[row.status] = row._count._all;
    const recent = await prisma.reportV2.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10
    });
    return { summary: summary as Record<ReportV2Status, number>, recent };
}

export async function cleanerTasks(
    ctx: V2AuthContext,
    args: { page?: number; limit?: number } = {}
): Promise<{ tasks: ReportV2[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, args.page ?? 1);
    const limit = Math.min(100, Math.max(1, args.limit ?? 100));
    const where: Prisma.ReportV2WhereInput = {
        assignedCleanerId: ctx.userId,
        status: { in: ['assigned', 'accepted_by_cleaner', 'in_progress', 'rejected_by_supervisor'] }
    };
    const [tasks, total] = await Promise.all([
        prisma.reportV2.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit
        }),
        prisma.reportV2.count({ where })
    ]);
    return { tasks, total, page, limit };
}

// ---- Mutations -----------------------------------------------------------

export async function createReport(ctx: V2AuthContext, input: CreateReportInput): Promise<MutationResult> {
    const tid = tenantId();

    // Geo association (best-effort, read-only, outside the transaction):
    // auto-fill the address from the nearest landmark when the reporter left
    // it blank, and flag out-of-campus coordinates in the event payload.
    let locationAddress = input.location_address;
    let outsideCampus: boolean | null = null;
    let landmarkName: string | null = null;
    if (input.location_lat !== undefined && input.location_lng !== undefined) {
        try {
            const resolved = await resolveLocation(input.location_lat, input.location_lng);
            outsideCampus = resolved.insideCampus === null ? null : !resolved.insideCampus;
            landmarkName = resolved.landmark?.name ?? null;
            if (!locationAddress && resolved.suggestedAddress) {
                locationAddress = resolved.suggestedAddress;
            }
        } catch {
            // Geo association must never block report creation.
        }
    }

    const { result, pushNotifications } = await prisma.$transaction(async (tx) => {
        const report = await tx.reportV2.create({
            data: {
                tenantId: tid,
                reporterUserId: ctx.userId,
                title: input.title,
                description: input.description,
                locationLat: input.location_lat,
                locationLng: input.location_lng,
                locationAddress,
                priority: input.priority ?? 'medium',
                status: 'submitted',
                version: 1
            } as Prisma.ReportV2UncheckedCreateInput
        });

        if (input.attachments && input.attachments.length > 0) {
            await tx.reportAttachmentV2.createMany({
                data: input.attachments.map((a) => ({
                    tenantId: tid,
                    reportId: report.id,
                    uploadedByUserId: ctx.userId,
                    attachmentType: a.attachment_type,
                    fileUrl: a.file_url,
                    fileMimeType: a.file_mime_type,
                    fileSize: a.file_size
                })) as Prisma.ReportAttachmentV2UncheckedCreateInput[]
            });
        }

        const event = await createEvent(tx, {
            reportId: report.id,
            eventType: 'report_created',
            actorUserId: ctx.userId,
            actorRole: 'reporter',
            payload: {
                status: report.status,
                title: report.title,
                ...(outsideCampus !== null ? { outside_campus: outsideCampus } : {}),
                ...(landmarkName ? { landmark: landmarkName } : {})
            }
        });

        // Fan out to all supervisors in the tenant.
        const supervisorIds = await findUsersWithRole(tx, 'supervisor');
        await notifyUsers(tx, {
            userIds: supervisorIds.filter((id) => id !== ctx.userId),
            reportId: report.id,
            eventId: event.id,
            title: 'New report submitted',
            body: `${report.title}`
        });

        await notifyUsers(tx, {
            userIds: [ctx.userId],
            reportId: report.id,
            eventId: event.id,
            title: 'Report submitted',
            body: report.title
        });

        return {
            result: { report, event, cursor: event.seq },
            pushNotifications: [
                {
                    userIds: supervisorIds.filter((id) => id !== ctx.userId),
                    reportId: report.id,
                    type: 'report_created',
                    title: 'New report submitted',
                    body: report.title,
                    data: { status: report.status, audience: 'supervisor' }
                },
                {
                    userIds: [ctx.userId],
                    reportId: report.id,
                    type: 'report_created',
                    title: 'Report submitted',
                    body: report.title,
                    data: { status: report.status, audience: 'reporter' }
                }
            ] satisfies PostCommitPushNotification[]
        };
    });

    await sendStagePushNotifications(pushNotifications);
    return result;
}

async function bumpVersionOrThrow(
    tx: Tx,
    reportId: string,
    expectedVersion: number,
    patch: Prisma.ReportV2UncheckedUpdateInput
): Promise<ReportV2> {
    const result = await tx.reportV2.updateMany({
        where: { id: reportId, version: expectedVersion },
        data: { ...patch, version: { increment: 1 } }
    });
    if (result.count === 0) {
        // Either the report does not exist or the version is stale.
        const exists = await tx.reportV2.findFirst({ where: { id: reportId }, select: { id: true } });
        if (!exists) throw new ReportNotFoundError();
        throw new StaleVersionError();
    }
    const fresh = await tx.reportV2.findFirst({ where: { id: reportId } });
    if (!fresh) throw new ReportNotFoundError();
    return fresh;
}

export async function assignCleaner(
    ctx: V2AuthContext,
    reportId: string,
    args: { cleaner_user_id: string; expected_completion_at?: string; note?: string }
): Promise<MutationResult> {
    const { result, pushNotifications } = await prisma.$transaction(async (tx) => {
        const existing = await tx.reportV2.findFirst({ where: { id: reportId } });
        if (!existing) throw new ReportNotFoundError();
        if (!['submitted', 'rejected_by_supervisor', 'rejected_by_cleaner', 'assigned'].includes(existing.status)) {
            throw new V2ConflictError(`Cannot assign cleaner while report is ${existing.status}.`);
        }

        const cleaner = await tx.userAccount.findFirst({
            where: { id: args.cleaner_user_id },
            select: { id: true, role: true }
        });
        if (!cleaner) throw new V2NotFoundError('Cleaner not found.');

        const report = await bumpVersionOrThrow(tx, reportId, existing.version, {
            status: 'assigned',
            assignedCleanerId: args.cleaner_user_id,
            assignedSupervisorId: ctx.userId
        });

        const event = await createEvent(tx, {
            reportId: report.id,
            eventType: 'report_assigned',
            actorUserId: ctx.userId,
            actorRole: 'supervisor',
            payload: {
                status: report.status,
                cleaner_user_id: args.cleaner_user_id,
                expected_completion_at: args.expected_completion_at,
                note: args.note
            }
        });

        await notifyUsers(tx, {
            userIds: [args.cleaner_user_id],
            reportId: report.id,
            eventId: event.id,
            title: 'New task assigned',
            body: report.title
        });

        await notifyUsers(tx, {
            userIds: [report.reporterUserId],
            reportId: report.id,
            eventId: event.id,
            title: 'Your report has been assigned',
            body: report.title
        });

        return {
            result: { report, event, cursor: event.seq },
            pushNotifications: [
                {
                    userIds: [args.cleaner_user_id],
                    reportId: report.id,
                    type: 'report_assigned',
                    title: 'New task assigned',
                    body: report.title,
                    data: { status: report.status, audience: 'cleaner' }
                },
                {
                    userIds: [report.reporterUserId],
                    reportId: report.id,
                    type: 'report_assigned',
                    title: 'Your report has been assigned',
                    body: report.title,
                    data: { status: report.status, audience: 'reporter' }
                }
            ] satisfies PostCommitPushNotification[]
        };
    });

    await sendStagePushNotifications(pushNotifications);
    return result;
}

export async function cleanerAccept(ctx: V2AuthContext, reportId: string): Promise<MutationResult> {
    const { result, pushNotifications } = await prisma.$transaction(async (tx) => {
        const existing = await tx.reportV2.findFirst({ where: { id: reportId } });
        if (!existing) throw new ReportNotFoundError();
        if (existing.assignedCleanerId !== ctx.userId) {
            throw new V2NotFoundError('Task not assigned to current user.');
        }
        if (existing.status !== 'assigned') {
            throw new V2ConflictError(`Cannot accept task while report is ${existing.status}.`);
        }

        const report = await bumpVersionOrThrow(tx, reportId, existing.version, {
            status: 'accepted_by_cleaner'
        });
        const event = await createEvent(tx, {
            reportId: report.id,
            eventType: 'cleaner_accepted_task',
            actorUserId: ctx.userId,
            actorRole: 'cleaner',
            payload: { status: report.status }
        });

        if (report.assignedSupervisorId) {
            await notifyUsers(tx, {
                userIds: [report.assignedSupervisorId],
                reportId: report.id,
                eventId: event.id,
                title: 'Cleaner accepted task',
                body: report.title
            });
        }

        await notifyUsers(tx, {
            userIds: [report.reporterUserId],
            reportId: report.id,
            eventId: event.id,
            title: 'A cleaner accepted your report',
            body: report.title
        });

        return {
            result: { report, event, cursor: event.seq },
            pushNotifications: [
                {
                    userIds: report.assignedSupervisorId ? [report.assignedSupervisorId] : [],
                    reportId: report.id,
                    type: 'cleaner_accepted_task',
                    title: 'Cleaner accepted task',
                    body: report.title,
                    data: { status: report.status, audience: 'supervisor' }
                },
                {
                    userIds: [report.reporterUserId],
                    reportId: report.id,
                    type: 'cleaner_accepted_task',
                    title: 'A cleaner accepted your report',
                    body: report.title,
                    data: { status: report.status, audience: 'reporter' }
                }
            ] satisfies PostCommitPushNotification[]
        };
    });

    await sendStagePushNotifications(pushNotifications);
    return result;
}

export async function cleanerReject(
    ctx: V2AuthContext,
    reportId: string,
    args: { reason: string }
): Promise<MutationResult> {
    const { result, pushNotifications } = await prisma.$transaction(async (tx) => {
        const existing = await tx.reportV2.findFirst({ where: { id: reportId } });
        if (!existing) throw new ReportNotFoundError();
        if (existing.assignedCleanerId !== ctx.userId) {
            throw new V2NotFoundError('Task not assigned to current user.');
        }
        if (!['assigned', 'accepted_by_cleaner'].includes(existing.status)) {
            throw new V2ConflictError(`Cannot reject task while report is ${existing.status}.`);
        }

        const report = await bumpVersionOrThrow(tx, reportId, existing.version, {
            status: 'rejected_by_cleaner'
        });
        const event = await createEvent(tx, {
            reportId: report.id,
            eventType: 'cleaner_rejected_task',
            actorUserId: ctx.userId,
            actorRole: 'cleaner',
            payload: { status: report.status, reason: args.reason }
        });

        if (report.assignedSupervisorId) {
            await notifyUsers(tx, {
                userIds: [report.assignedSupervisorId],
                reportId: report.id,
                eventId: event.id,
                title: 'Cleaner rejected task',
                body: args.reason
            });
        }

        await notifyUsers(tx, {
            userIds: [report.reporterUserId],
            reportId: report.id,
            eventId: event.id,
            title: 'Your report needs reassignment',
            body: args.reason
        });

        return {
            result: { report, event, cursor: event.seq },
            pushNotifications: [
                {
                    userIds: report.assignedSupervisorId ? [report.assignedSupervisorId] : [],
                    reportId: report.id,
                    type: 'cleaner_rejected_task',
                    title: 'Cleaner rejected task',
                    body: args.reason,
                    data: { status: report.status, audience: 'supervisor' }
                },
                {
                    userIds: [report.reporterUserId],
                    reportId: report.id,
                    type: 'cleaner_rejected_task',
                    title: 'Your report needs reassignment',
                    body: args.reason,
                    data: { status: report.status, audience: 'reporter' }
                }
            ] satisfies PostCommitPushNotification[]
        };
    });

    await sendStagePushNotifications(pushNotifications);
    return result;
}

export async function cleanerStart(ctx: V2AuthContext, reportId: string): Promise<MutationResult> {
    const { result, pushNotifications } = await prisma.$transaction(async (tx) => {
        const existing = await tx.reportV2.findFirst({ where: { id: reportId } });
        if (!existing) throw new ReportNotFoundError();
        if (existing.assignedCleanerId !== ctx.userId) {
            throw new V2NotFoundError('Task not assigned to current user.');
        }
        if (!['accepted_by_cleaner', 'rejected_by_supervisor'].includes(existing.status)) {
            throw new V2ConflictError(`Cannot start task while report is ${existing.status}.`);
        }

        const report = await bumpVersionOrThrow(tx, reportId, existing.version, {
            status: 'in_progress'
        });
        const event = await createEvent(tx, {
            reportId: report.id,
            eventType: 'cleaner_started_work',
            actorUserId: ctx.userId,
            actorRole: 'cleaner',
            payload: { status: report.status }
        });

        if (report.assignedSupervisorId) {
            await notifyUsers(tx, {
                userIds: [report.assignedSupervisorId],
                reportId: report.id,
                eventId: event.id,
                title: 'Cleaner started work',
                body: report.title
            });
        }

        await notifyUsers(tx, {
            userIds: [report.reporterUserId],
            reportId: report.id,
            eventId: event.id,
            title: 'Work started on your report',
            body: report.title
        });

        return {
            result: { report, event, cursor: event.seq },
            pushNotifications: [
                {
                    userIds: report.assignedSupervisorId ? [report.assignedSupervisorId] : [],
                    reportId: report.id,
                    type: 'cleaner_started_work',
                    title: 'Cleaner started work',
                    body: report.title,
                    data: { status: report.status, audience: 'supervisor' }
                },
                {
                    userIds: [report.reporterUserId],
                    reportId: report.id,
                    type: 'cleaner_started_work',
                    title: 'Work started on your report',
                    body: report.title,
                    data: { status: report.status, audience: 'reporter' }
                }
            ] satisfies PostCommitPushNotification[]
        };
    });

    await sendStagePushNotifications(pushNotifications);
    return result;
}

export async function cleanerResolve(
    ctx: V2AuthContext,
    reportId: string,
    args: { note?: string; attachments?: AttachmentInput[] }
): Promise<MutationResult> {
    const tid = tenantId();
    const { result, pushNotifications } = await prisma.$transaction(async (tx) => {
        const existing = await tx.reportV2.findFirst({ where: { id: reportId } });
        if (!existing) throw new ReportNotFoundError();
        if (existing.assignedCleanerId !== ctx.userId) {
            throw new V2NotFoundError('Task not assigned to current user.');
        }
        if (existing.status !== 'in_progress') {
            throw new V2ConflictError(`Cannot resolve task while report is ${existing.status}.`);
        }

        if (args.attachments && args.attachments.length > 0) {
            await tx.reportAttachmentV2.createMany({
                data: args.attachments.map((a) => ({
                    tenantId: tid,
                    reportId: existing.id,
                    uploadedByUserId: ctx.userId,
                    attachmentType: a.attachment_type,
                    fileUrl: a.file_url,
                    fileMimeType: a.file_mime_type,
                    fileSize: a.file_size
                })) as Prisma.ReportAttachmentV2UncheckedCreateInput[]
            });
        }

        const report = await bumpVersionOrThrow(tx, reportId, existing.version, {
            status: 'resolved_by_cleaner'
        });
        const event = await createEvent(tx, {
            reportId: report.id,
            eventType: 'cleaner_submitted_resolution',
            actorUserId: ctx.userId,
            actorRole: 'cleaner',
            payload: { status: report.status, note: args.note }
        });

        if (report.assignedSupervisorId) {
            await notifyUsers(tx, {
                userIds: [report.assignedSupervisorId],
                reportId: report.id,
                eventId: event.id,
                title: 'Task resolved',
                body: 'Cleaner has submitted resolution evidence.'
            });
        }

        await notifyUsers(tx, {
            userIds: [report.reporterUserId],
            reportId: report.id,
            eventId: event.id,
            title: 'Resolution submitted for your report',
            body: report.title
        });

        return {
            result: { report, event, cursor: event.seq },
            pushNotifications: [
                {
                    userIds: report.assignedSupervisorId ? [report.assignedSupervisorId] : [],
                    reportId: report.id,
                    type: 'cleaner_submitted_resolution',
                    title: 'Task resolved',
                    body: 'Cleaner has submitted resolution evidence.',
                    data: { status: report.status, audience: 'supervisor' }
                },
                {
                    userIds: [report.reporterUserId],
                    reportId: report.id,
                    type: 'cleaner_submitted_resolution',
                    title: 'Resolution submitted for your report',
                    body: report.title,
                    data: { status: report.status, audience: 'reporter' }
                }
            ] satisfies PostCommitPushNotification[]
        };
    });

    await sendStagePushNotifications(pushNotifications);
    return result;
}

export async function supervisorEndorse(
    ctx: V2AuthContext,
    reportId: string,
    args: { note?: string }
): Promise<MutationResult> {
    const { result, pushNotifications } = await prisma.$transaction(async (tx) => {
        const existing = await tx.reportV2.findFirst({ where: { id: reportId } });
        if (!existing) throw new ReportNotFoundError();
        if (existing.status !== 'resolved_by_cleaner') {
            throw new V2ConflictError(`Cannot endorse while report is ${existing.status}.`);
        }

        const report = await bumpVersionOrThrow(tx, reportId, existing.version, {
            status: 'endorsed_by_supervisor',
            assignedSupervisorId: ctx.userId
        });
        const event = await createEvent(tx, {
            reportId: report.id,
            eventType: 'supervisor_endorsed',
            actorUserId: ctx.userId,
            actorRole: 'supervisor',
            payload: { status: report.status, note: args.note }
        });
        await notifyUsers(tx, {
            userIds: [report.reporterUserId],
            reportId: report.id,
            eventId: event.id,
            title: 'Your report was resolved',
            body: report.title
        });

        if (report.assignedCleanerId) {
            await notifyUsers(tx, {
                userIds: [report.assignedCleanerId],
                reportId: report.id,
                eventId: event.id,
                title: 'Supervisor endorsed completion',
                body: report.title
            });
        }

        return {
            result: { report, event, cursor: event.seq },
            pushNotifications: [
                {
                    userIds: [report.reporterUserId],
                    reportId: report.id,
                    type: 'supervisor_endorsed',
                    title: 'Your report was resolved',
                    body: report.title,
                    data: { status: report.status, audience: 'reporter' }
                },
                {
                    userIds: report.assignedCleanerId ? [report.assignedCleanerId] : [],
                    reportId: report.id,
                    type: 'supervisor_endorsed',
                    title: 'Supervisor endorsed completion',
                    body: report.title,
                    data: { status: report.status, audience: 'cleaner' }
                }
            ] satisfies PostCommitPushNotification[]
        };
    });

    await sendStagePushNotifications(pushNotifications);
    return result;
}

export async function supervisorReject(
    ctx: V2AuthContext,
    reportId: string,
    args: { reason: string }
): Promise<MutationResult> {
    const { result, pushNotifications } = await prisma.$transaction(async (tx) => {
        const existing = await tx.reportV2.findFirst({ where: { id: reportId } });
        if (!existing) throw new ReportNotFoundError();
        if (existing.status !== 'resolved_by_cleaner') {
            throw new V2ConflictError(`Cannot reject while report is ${existing.status}.`);
        }

        const report = await bumpVersionOrThrow(tx, reportId, existing.version, {
            status: 'rejected_by_supervisor',
            assignedSupervisorId: ctx.userId
        });
        const event = await createEvent(tx, {
            reportId: report.id,
            eventType: 'supervisor_rejected',
            actorUserId: ctx.userId,
            actorRole: 'supervisor',
            payload: { status: report.status, reason: args.reason }
        });
        if (report.assignedCleanerId) {
            await notifyUsers(tx, {
                userIds: [report.assignedCleanerId],
                reportId: report.id,
                eventId: event.id,
                title: 'Resolution rejected',
                body: args.reason
            });
        }

        await notifyUsers(tx, {
            userIds: [report.reporterUserId],
            reportId: report.id,
            eventId: event.id,
            title: 'Your report needs more work',
            body: args.reason
        });

        return {
            result: { report, event, cursor: event.seq },
            pushNotifications: [
                {
                    userIds: report.assignedCleanerId ? [report.assignedCleanerId] : [],
                    reportId: report.id,
                    type: 'supervisor_rejected',
                    title: 'Resolution rejected',
                    body: args.reason,
                    data: { status: report.status, audience: 'cleaner' }
                },
                {
                    userIds: [report.reporterUserId],
                    reportId: report.id,
                    type: 'supervisor_rejected',
                    title: 'Your report needs more work',
                    body: args.reason,
                    data: { status: report.status, audience: 'reporter' }
                }
            ] satisfies PostCommitPushNotification[]
        };
    });

    await sendStagePushNotifications(pushNotifications);
    return result;
}

// Expose role-resolution helper for actor-role calculation in routes.
export { actorRoleFor };
