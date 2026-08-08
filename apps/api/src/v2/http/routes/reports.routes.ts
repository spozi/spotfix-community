import { Router } from 'express';

import { asyncHandler } from '../../../http/asyncHandler';
import { photosService } from '../../../domain/photos/photos.service';
import {
    createReport,
    getReportByIdForActor,
    listMyReports
} from '../../reports/reports.service';
import { created, ok } from '../envelope';
import { requireV2Auth, requireV2Role } from '../auth.middleware';
import { CreateReportV2Schema, PageQuerySchema } from '../schemas';
import {
    mutationEnvelope,
    serializeAttachment,
    serializeEvent,
    serializeReport,
    serializeReportSummary
} from '../serializers';
import { validateV2 } from '../validate';

export function buildReportsV2Router(): Router {
    const router = Router();

    // POST /api/v2/reports
    router.post(
        '/',
        requireV2Auth,
        requireV2Role('reporter'),
        validateV2(CreateReportV2Schema, 'body'),
        asyncHandler(async (req, res) => {
            const ctx = req.v2Auth!;
            const result = await createReport(ctx, req.body);
            created(res, mutationEnvelope(result));
        })
    );

    // GET /api/v2/reports/my?page=&limit=
    router.get(
        '/my',
        requireV2Auth,
        requireV2Role('reporter'),
        validateV2(PageQuerySchema, 'query'),
        asyncHandler(async (req, res) => {
            const ctx = req.v2Auth!;
            const q = req.query as { page?: number; limit?: number };
            const { reports, total, page, limit } = await listMyReports(ctx, q);
            ok(res, {
                reports: reports.map(serializeReportSummary),
                total,
                page,
                limit
            });
        })
    );

    // GET /api/v2/reports/:id
    router.get(
        '/:id',
        requireV2Auth,
        asyncHandler(async (req, res) => {
            const ctx = req.v2Auth!;
            const { report, attachments, events } = await getReportByIdForActor(
                String(req.params.id),
                ctx
            );
            const serializedAttachments = await Promise.all(
                attachments.map(async (attachment) => {
                    const fileUrl = await photosService.resolvePhotoString(attachment.fileUrl);
                    return serializeAttachment(attachment, fileUrl ?? attachment.fileUrl);
                })
            );
            ok(res, {
                report: serializeReport(report),
                attachments: serializedAttachments,
                events: events.map(serializeEvent)
            });
        })
    );

    return router;
}
