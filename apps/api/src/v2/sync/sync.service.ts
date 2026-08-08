/**
 * v2 sync service. Implements §13.1.
 *
 * The cursor is the monotonic `seq` integer on ReportEventV2.
 * Android passes the last-seen cursor as `since`; we return events with
 * seq > since, ordered ascending, capped at a sane page size.
 *
 * Visibility: supervisors/admins see every event in the tenant; everyone
 * else only sees events for reports they are a party to (reporter, assigned
 * cleaner, or assigned supervisor).
 */
import { Prisma } from '@prisma/client';
import type { ReportEventV2 } from '@prisma/client';

import { prisma } from '../../infra/prisma';
import type { V2AuthContext } from '../auth/v2-auth.service';

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

export interface SyncResult {
    events: ReportEventV2[];
    nextCursor: number | null;
}

export async function getEventsSince(
    args: {
        since?: number;
        limit?: number;
        reportId?: string;
    },
    ctx: V2AuthContext
): Promise<SyncResult> {
    const limit = Math.min(MAX_LIMIT, Math.max(1, args.limit ?? DEFAULT_LIMIT));
    const where: Prisma.ReportEventV2WhereInput = {};
    if (args.since !== undefined) where.seq = { gt: args.since };
    if (args.reportId) where.reportId = args.reportId;

    // Visibility filter for non-supervisor/non-admin callers.
    if (!ctx.roles.supervisor && !ctx.roles.admin) {
        where.report = {
            is: {
                OR: [
                    { reporterUserId: ctx.userId },
                    { assignedCleanerId: ctx.userId },
                    { assignedSupervisorId: ctx.userId }
                ]
            }
        };
    }

    const events = await prisma.reportEventV2.findMany({
        where,
        orderBy: { seq: 'asc' },
        take: limit
    });
    const last = events[events.length - 1];
    return {
        events,
        nextCursor: last ? last.seq : args.since ?? null
    };
}
