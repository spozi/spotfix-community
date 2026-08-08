import type { Cleaner, Prisma } from '@prisma/client';

import { prisma } from '../../infra/prisma';

export type CleanerRow = Cleaner;

export interface CleanerListQuery {
    supervisorId?: string;
    workLocation?: string;
}

export interface CreateCleanerInput {
    name: string;
    workId: string;
    phone?: string;
    workLocation?: string;
    supervisorId: string;
    supervisorName: string;
}

export const cleanersRepository = {
    async list(query: CleanerListQuery): Promise<CleanerRow[]> {
        return prisma.cleaner.findMany({
            where: {
                ...(query.supervisorId ? { supervisorId: query.supervisorId } : {}),
                ...(query.workLocation ? { workLocation: query.workLocation } : {})
            },
            orderBy: { name: 'asc' }
        });
    },

    async findById(id: string): Promise<CleanerRow | null> {
        return prisma.cleaner.findFirst({ where: { id } });
    },

    async findByWorkId(workId: string): Promise<CleanerRow | null> {
        return prisma.cleaner.findFirst({ where: { workId } });
    },

    async findAllForUser(opts: { idNumber?: string | null; name?: string | null }): Promise<CleanerRow[]> {
        const normalizedId = opts.idNumber?.trim();
        const normalizedName = opts.name?.trim();
        const conditions: Prisma.CleanerWhereInput[] = [];
        if (normalizedId) {
            conditions.push({ workId: { equals: normalizedId, mode: 'insensitive' } });
        }
        if (normalizedName) {
            conditions.push({ name: { equals: normalizedName, mode: 'insensitive' } });
        }
        if (conditions.length === 0) {
            return [];
        }
        return prisma.cleaner.findMany({ where: { OR: conditions } });
    },

    async create(input: CreateCleanerInput): Promise<CleanerRow> {
        const data: Prisma.CleanerUncheckedCreateInput = {
            tenantId: '',
            name: input.name,
            workId: input.workId,
            phone: input.phone,
            workLocation: input.workLocation,
            supervisorId: input.supervisorId,
            supervisorName: input.supervisorName
        };
        delete (data as { tenantId?: string }).tenantId;
        return prisma.cleaner.create({
            data: data as Prisma.CleanerUncheckedCreateInput
        });
    },

    async setSupervisor(id: string, supervisorId: string, supervisorName: string): Promise<CleanerRow | null> {
        await prisma.cleaner.updateMany({
            where: { id },
            data: { supervisorId, supervisorName }
        });
        return prisma.cleaner.findFirst({ where: { id } });
    },

    async assignTask(
        id: string,
        opts: { supervisorId: string; supervisorName: string; reportId: string; busyUntil: Date }
    ): Promise<CleanerRow | null> {
        await prisma.cleaner.updateMany({
            where: { id },
            data: {
                supervisorId: opts.supervisorId,
                supervisorName: opts.supervisorName,
                assignedTaskId: opts.reportId,
                busyUntil: opts.busyUntil
            }
        });
        return prisma.cleaner.findFirst({ where: { id } });
    },

    async clearAssignmentByTaskId(taskId: string): Promise<void> {
        await prisma.cleaner.updateMany({
            where: { assignedTaskId: taskId },
            data: { assignedTaskId: null, busyUntil: null }
        });
    }
};
