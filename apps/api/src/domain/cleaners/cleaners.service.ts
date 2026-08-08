import { ForbiddenError, NotFoundError, ValidationError } from '../../errors';
import { masterRepository } from '../master/master.repository';
import { pushNotificationsService } from '../notifications/push-notifications.service';
import { reportsRepository } from '../reports/reports.repository';
import { usersRepository } from '../users/users.repository';
import { cleanersRepository, type CleanerRow } from './cleaners.repository';

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export interface SerializedCleaner {
    _id: string;
    name: string;
    workId: string;
    phone?: string;
    workLocation?: string;
    supervisorId?: string;
    supervisorName?: string;
    isBusy: boolean;
    assignedTaskId: string | null;
    busyUntil: Date | null;
    status: 'Busy' | 'Free';
    timeLeft: number;
}

function serializeCleaner(row: CleanerRow, now = new Date()): SerializedCleaner {
    const busyUntilDate = row.busyUntil ? new Date(row.busyUntil) : null;
    const isBusy = Boolean(row.assignedTaskId);

    return {
        _id: row.id,
        name: row.name,
        workId: row.workId,
        phone: row.phone ?? undefined,
        workLocation: row.workLocation ?? undefined,
        supervisorId: row.supervisorId ?? undefined,
        supervisorName: row.supervisorName ?? undefined,
        isBusy,
        assignedTaskId: row.assignedTaskId ?? null,
        busyUntil: busyUntilDate,
        status: isBusy ? 'Busy' : 'Free',
        timeLeft: isBusy && busyUntilDate ? Math.max(0, busyUntilDate.getTime() - now.getTime()) : 0
    };
}

interface ResolvedSupervisor {
    id: string;
    name: string;
}

async function resolveSupervisor(
    actor: { role: string; userId: string; name: string },
    supervisorIdFromBody: string | undefined
): Promise<ResolvedSupervisor> {
    if (actor.role === 'supervisor') {
        return { id: actor.userId, name: actor.name };
    }

    if (!supervisorIdFromBody) {
        throw new ValidationError('supervisorId is required');
    }

    const supervisor = await usersRepository.findById(supervisorIdFromBody);

    if (!supervisor || supervisor.role !== 'supervisor') {
        throw new ValidationError('Valid supervisorId is required');
    }

    return { id: supervisor.id, name: supervisor.name };
}

export const cleanersService = {
    async list(actor: { role: string; userId: string }, query: { supervisorId?: string; workLocation?: string }): Promise<SerializedCleaner[]> {
        const supervisorId = query.supervisorId ?? (actor.role === 'supervisor' ? actor.userId : undefined);
        let workLocation = query.workLocation?.trim() || undefined;

        if (actor.role === 'supervisor' && !workLocation) {
            const supervisor = await usersRepository.findById(actor.userId);
            workLocation = supervisor?.workLocation?.trim() || undefined;
        }

        const rows = await cleanersRepository.list({ supervisorId, workLocation });

        const now = new Date();
        return rows.map((d) => serializeCleaner(d, now));
    },

    async create(
        actor: { role: string; userId: string; name: string },
        input: { name: string; workId: string; phone?: string; workLocation?: string; supervisorId?: string }
    ): Promise<SerializedCleaner> {
        const supervisor = await resolveSupervisor(actor, input.supervisorId);
        const created = await cleanersRepository.create({
            name: input.name,
            workId: input.workId,
            phone: input.phone,
            workLocation: input.workLocation,
            supervisorId: supervisor.id,
            supervisorName: supervisor.name
        });
        return serializeCleaner(created);
    },

    async reassignSupervisor(
        actor: { role: string; userId: string; name: string },
        cleanerId: string,
        supervisorIdFromBody: string | undefined
    ): Promise<SerializedCleaner> {
        const supervisor = await resolveSupervisor(actor, supervisorIdFromBody);
        const cleaner = await cleanersRepository.setSupervisor(cleanerId, supervisor.id, supervisor.name);
        if (!cleaner) {
            throw new NotFoundError('Cleaner not found');
        }
        return serializeCleaner(cleaner);
    },

    async assignToReport(
        actor: { role: string; userId: string; name: string },
        cleanerId: string,
        reportId: string,
        supervisorIdFromBody: string | undefined
    ): Promise<SerializedCleaner> {
        const supervisor = await resolveSupervisor(actor, supervisorIdFromBody);

        const existing = await cleanersRepository.findById(cleanerId);
        if (!existing) {
            throw new NotFoundError('Cleaner not found');
        }

        if (existing.supervisorId && existing.supervisorId !== supervisor.id) {
            throw new ForbiddenError('Cleaner does not work under this supervisor');
        }

        const busyUntil = new Date(Date.now() + TWO_HOURS_MS);
        const cleaner = await cleanersRepository.assignTask(cleanerId, {
            supervisorId: supervisor.id,
            supervisorName: supervisor.name,
            reportId,
            busyUntil
        });

        if (!cleaner) {
            throw new NotFoundError('Cleaner not found');
        }

        const assignedReport = await reportsRepository.assignToCleaner(reportId, {
            cleanerId: cleaner.id,
            cleanerName: cleaner.name,
            supervisorId: supervisor.id,
            supervisorName: supervisor.name
        });

        const cleanerAccount = await usersRepository.findByIdNumber(cleaner.workId);
        if (assignedReport) {
            const masterIds = ['High', 'Critical'].includes(assignedReport.priority)
                ? (await masterRepository.listAll()).map((master) => master.id)
                : [];

            if (cleanerAccount?.role === 'cleaner' && cleanerAccount.status === 'active') {
                await pushNotificationsService.sendToRecipients({
                    userIds: [cleanerAccount.id],
                    reportId: assignedReport.publicId,
                    type: 'report_assigned',
                    title: 'New cleaning job assigned',
                    body: `${assignedReport.category ?? 'An issue'} at ${assignedReport.location ?? 'the reported location'} has been assigned to you.`,
                    data: {
                        location: assignedReport.location ?? ''
                    },
                    isCritical: masterIds.length > 0
                });
            }

            await pushNotificationsService.sendToRecipients({
                userIds: [assignedReport.userId, supervisor.id],
                masterUserIds: masterIds,
                reportId: assignedReport.publicId,
                type: 'report_acknowledged',
                title: 'Report acknowledged',
                body: `${assignedReport.publicId} has been assigned to ${cleaner.name} and is now awaiting completion.`,
                data: {
                    location: assignedReport.location ?? ''
                },
                isCritical: masterIds.length > 0
            });
        }

        return serializeCleaner(cleaner);
    },

    serialize: serializeCleaner
};
