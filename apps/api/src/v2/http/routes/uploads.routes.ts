import { Router } from 'express';

import { asyncHandler } from '../../../http/asyncHandler';
import { photosService } from '../../../domain/photos/photos.service';
import { prisma } from '../../../infra/prisma';
import { ReportNotFoundError } from '../../errors';
import { ok } from '../envelope';
import { requireV2Auth } from '../auth.middleware';
import { PresignUploadV2Schema } from '../schemas';
import { validateV2 } from '../validate';

export function buildUploadsV2Router(): Router {
    const router = Router();

    // POST /api/v2/uploads/presign
    // Returns a presigned PUT URL for direct client upload to object storage.
    // Body: { report_id, kind, content_type, content_length? }
    // Response data: { upload_url, method, headers, expires_in, file_url }
    // file_url is the tenant-scoped object key; pass it back to the report
    // attachment endpoints as `file_url` once the PUT succeeds.
    router.post(
        '/presign',
        requireV2Auth,
        validateV2(PresignUploadV2Schema, 'body'),
        asyncHandler(async (req, res) => {
            const ctx = req.v2Auth!;
            const body = req.body as {
                report_id: string;
                kind: 'evidence' | 'resolution' | 'extra';
                content_type: string;
                content_length?: number;
            };

            // Ownership check: when the id refers to an existing report, only
            // parties to that report (or supervisors/admins) may mint upload
            // URLs into its folder. Unknown ids are the composer's draft flow
            // (attachments upload before POST /reports creates the row) —
            // allowed, since draft keys stay unreferenced unless the uploader
            // attaches them to their own report.
            const report = await prisma.reportV2.findFirst({
                where: { id: body.report_id },
                select: {
                    reporterUserId: true,
                    assignedCleanerId: true,
                    assignedSupervisorId: true
                }
            });
            if (report) {
                const canUpload =
                    report.reporterUserId === ctx.userId ||
                    report.assignedCleanerId === ctx.userId ||
                    report.assignedSupervisorId === ctx.userId ||
                    ctx.roles.supervisor ||
                    ctx.roles.admin;
                if (!canUpload) throw new ReportNotFoundError();
            }

            const presigned = await photosService.presignUploadUrl({
                reportId: body.report_id,
                kind: body.kind,
                contentType: body.content_type,
                contentLength: body.content_length
            });
            ok(res, {
                upload_url: presigned.uploadUrl,
                method: presigned.method,
                headers: presigned.headers,
                expires_in: presigned.expiresIn,
                file_url: presigned.key
            });
        })
    );

    return router;
}
