import { Prisma, type Report } from '@prisma/client';

import { prisma, prismaRaw } from '../../infra/prisma';

export type ReportRow = Report;

export interface ReportListFilter {
    userId?: string;
    cleanerId?: string;
    cleanerName?: string;
    cleanerIds?: string[];
    cleanerNames?: string[];
}

export interface CreateReportInput {
    publicId?: string;
    userId: string;
    userName?: string;
    status?: string;
    priority?: string;
    category?: string;
    location?: string;
    details?: string;
    coordinates?: unknown;
    reporterPhone?: string;
    evidencePhoto?: string;
    photos?: unknown[];
    photoTimestamp?: string;
    timestamp?: Date;
}

function toCreateData(input: CreateReportInput): Prisma.ReportUncheckedCreateInput {
    return {
        // tenantId is auto-injected by the prisma extension.
        tenantId: '',
        publicId: input.publicId ?? '',
        userId: input.userId,
        userName: input.userName ?? null,
        status: input.status ?? 'Submitted',
        priority: input.priority ?? 'Medium',
        category: input.category ?? null,
        location: input.location ?? null,
        details: input.details ?? null,
        coordinates: (input.coordinates as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        reporterPhone: input.reporterPhone ?? null,
        evidencePhoto: input.evidencePhoto ?? null,
        photos: (input.photos as Prisma.InputJsonValue) ?? [],
        photoTimestamp: input.photoTimestamp ?? null,
        timestamp: input.timestamp ?? new Date()
    };
}

export const reportsRepository = {
    async nextPublicId(tenantId: string): Promise<string> {
        const nextNumber = await prismaRaw.$transaction(async (tx) => {
            const existing = await tx.reportSequence.findUnique({ where: { tenantId } });

            if (!existing) {
                const [row] = await tx.$queryRaw<Array<{ maxnum: number | null }>>`
                    SELECT MAX(
                        CASE
                            WHEN "publicId" ~ '^RPT-[0-9]+$'
                                THEN CAST(SUBSTRING("publicId" FROM 5) AS INTEGER)
                            ELSE NULL
                        END
                    ) AS maxnum
                    FROM "Report"
                    WHERE "tenantId" = ${tenantId}
                `;

                const base = Math.max(99999, Number(row?.maxnum ?? 99999));

                await tx.reportSequence.create({
                    data: {
                        tenantId,
                        currentNumber: base
                    }
                });
            }

            const updated = await tx.reportSequence.update({
                where: { tenantId },
                data: { currentNumber: { increment: 1 } }
            });

            return updated.currentNumber;
        });

        return `RPT-${nextNumber}`;
    },

    async list(filter: ReportListFilter): Promise<ReportRow[]> {
        const where: Prisma.ReportWhereInput = {
            ...(filter.userId ? { userId: filter.userId } : {})
        };

        if (filter.cleanerId || filter.cleanerName || filter.cleanerIds?.length || filter.cleanerNames?.length) {
            const or: Prisma.ReportWhereInput[] = [];
            if (filter.cleanerId) {
                or.push({ assignedToCleanerId: filter.cleanerId });
            }
            if (filter.cleanerIds?.length) {
                or.push({ assignedToCleanerId: { in: filter.cleanerIds } });
            }
            if (filter.cleanerName) {
                or.push({ assignedTo: filter.cleanerName });
            }
            if (filter.cleanerNames?.length) {
                or.push({ assignedTo: { in: filter.cleanerNames } });
            }
            if (or.length > 0) {
                where.AND = [{ OR: or }];
            }
        }

        return prisma.report.findMany({
            where,
            orderBy: { timestamp: 'desc' }
        });
    },

    async findByPublicId(publicId: string): Promise<ReportRow | null> {
        return prisma.report.findFirst({ where: { publicId } });
    },

    async create(input: CreateReportInput): Promise<ReportRow> {
        const data = toCreateData(input);
        // tenantId field is removed by the extension and re-added from context.
        delete (data as { tenantId?: string }).tenantId;
        return prisma.report.create({ data: data as Prisma.ReportUncheckedCreateInput });
    },

    async update(publicId: string, patch: Record<string, unknown>): Promise<ReportRow | null> {
        await prisma.report.updateMany({
            where: { publicId },
            data: patch as Prisma.ReportUncheckedUpdateManyInput
        });
        return prisma.report.findFirst({ where: { publicId } });
    },

    async assignToCleaner(
        reportPublicId: string,
        opts: { cleanerId: string; cleanerName: string; supervisorId: string; supervisorName: string }
    ): Promise<ReportRow | null> {
        await prisma.report.updateMany({
            where: { publicId: reportPublicId },
            data: {
                assignedTo: opts.cleanerName,
                assignedToCleanerId: opts.cleanerId,
                assignedBySupervisorId: opts.supervisorId,
                assignedBySupervisorName: opts.supervisorName,
                status: 'Assigned'
            }
        });
        return prisma.report.findFirst({ where: { publicId: reportPublicId } });
    }
};
