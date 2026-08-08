import { Router } from 'express';

import { asyncHandler } from '../../../http/asyncHandler';
import {
    cleanerAccept,
    cleanerReject,
    cleanerResolve,
    cleanerStart,
    cleanerTasks
} from '../../reports/reports.service';
import { requireV2Auth, requireV2Role } from '../auth.middleware';
import { ok } from '../envelope';
import { PageQuerySchema, RejectSchema, ResolveTaskSchema } from '../schemas';
import { mutationEnvelope, serializeReportSummary } from '../serializers';
import { validateV2 } from '../validate';

export function buildCleanerV2Router(): Router {
    const router = Router();
    router.use(requireV2Auth, requireV2Role('cleaner'));

    // GET /api/v2/cleaner/tasks?page=&limit=
    router.get(
        '/tasks',
        validateV2(PageQuerySchema, 'query'),
        asyncHandler(async (req, res) => {
            const ctx = req.v2Auth!;
            const q = req.query as { page?: number; limit?: number };
            const { tasks, total, page, limit } = await cleanerTasks(ctx, q);
            ok(res, {
                tasks: tasks.map(serializeReportSummary),
                total,
                page,
                limit
            });
        })
    );

    // PATCH /api/v2/cleaner/tasks/:id/accept
    router.patch(
        '/tasks/:id/accept',
        asyncHandler(async (req, res) => {
            const ctx = req.v2Auth!;
            const result = await cleanerAccept(ctx, String(req.params.id));
            ok(res, mutationEnvelope(result));
        })
    );

    // PATCH /api/v2/cleaner/tasks/:id/reject
    router.patch(
        '/tasks/:id/reject',
        validateV2(RejectSchema, 'body'),
        asyncHandler(async (req, res) => {
            const ctx = req.v2Auth!;
            const result = await cleanerReject(ctx, String(req.params.id), req.body);
            ok(res, mutationEnvelope(result));
        })
    );

    // PATCH /api/v2/cleaner/tasks/:id/start
    router.patch(
        '/tasks/:id/start',
        asyncHandler(async (req, res) => {
            const ctx = req.v2Auth!;
            const result = await cleanerStart(ctx, String(req.params.id));
            ok(res, mutationEnvelope(result));
        })
    );

    // PATCH /api/v2/cleaner/tasks/:id/resolve
    router.patch(
        '/tasks/:id/resolve',
        validateV2(ResolveTaskSchema, 'body'),
        asyncHandler(async (req, res) => {
            const ctx = req.v2Auth!;
            const result = await cleanerResolve(ctx, String(req.params.id), req.body);
            ok(res, mutationEnvelope(result));
        })
    );

    return router;
}
