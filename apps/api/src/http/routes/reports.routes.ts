import { Router } from 'express';

import { photosService } from '../../domain/photos/photos.service';
import { reportsService } from '../../domain/reports/reports.service';
import { asyncHandler } from '../asyncHandler';
import { requireAuth, requireRoles, requireSelfOrRoles } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import { validate } from '../middleware/validate';
import {
    ConfirmPhotoSchema,
    CreateReportSchema,
    PresignPhotoSchema,
    ReportIdParamSchema,
    UpdateReportSchema,
    UploadPhotoSchema,
    UserIdParamSchema
} from '../schemas';

export function buildReportsRouter(): Router {
    const router = Router();

    router.get(
        '/',
        requireAuth,
        requireRoles('public', 'supervisor', 'cleaner', 'master'),
        asyncHandler(async (req, res) => {
            res.json(await reportsService.list({
                role: req.auth!.role,
                userId: req.auth!.userId,
                name: req.auth!.name
            }));
        })
    );

    router.get(
        '/public/status',
        requireTenant,
        asyncHandler(async (_req, res) => {
            res.json(await reportsService.getPublicStatusBoard());
        })
    );

    router.get(
        '/:id',
        requireAuth,
        validate(ReportIdParamSchema, 'params'),
        asyncHandler(async (req, res) => {
            const { id } = req.params as { id: string };
            const report = await reportsService.getById(id, {
                role: req.auth!.role,
                userId: req.auth!.userId
            });
            res.json(report);
        })
    );

    router.post(
        '/',
        requireAuth,
        validate(CreateReportSchema, 'body'),
        asyncHandler(async (req, res) => {
            const report = await reportsService.create(
                { role: req.auth!.role, userId: req.auth!.userId, name: req.auth!.name },
                req.body
            );
            res.status(201).json(report);
        })
    );

    router.put(
        '/:id',
        requireAuth,
        requireRoles('supervisor', 'cleaner', 'master'),
        validate(ReportIdParamSchema, 'params'),
        validate(UpdateReportSchema, 'body'),
        asyncHandler(async (req, res) => {
            const { id } = req.params as { id: string };
            const updated = await reportsService.update(id, req.body, {
                role: req.auth!.role,
                userId: req.auth!.userId,
                name: req.auth!.name
            });
            res.json(updated);
        })
    );

    router.get(
        '/user/:userId',
        requireAuth,
        validate(UserIdParamSchema, 'params'),
        requireSelfOrRoles('userId', 'supervisor', 'master'),
        asyncHandler(async (req, res) => {
            const { userId } = req.params as { userId: string };
            res.json(await reportsService.listForUser(userId));
        })
    );

    // P3 — request a short-lived presigned PUT URL so the mobile client can
    // upload binary photo data directly to MinIO/S3 without piping through
    // the API. Returns { key, uploadUrl, headers, expiresIn }.
    router.post(
        '/:id/photos/presign',
        requireAuth,
        validate(ReportIdParamSchema, 'params'),
        validate(PresignPhotoSchema, 'body'),
        asyncHandler(async (req, res) => {
            const { id } = req.params as { id: string };
            const result = await photosService.presignUploadUrl({
                reportId: id,
                kind: req.body.kind,
                contentType: req.body.contentType,
                contentLength: req.body.contentLength
            });
            res.status(201).json(result);
        })
    );

    // After a successful direct upload, clients call this to attach the
    // resulting object key to the report.
    router.post(
        '/:id/photos/confirm',
        requireAuth,
        validate(ReportIdParamSchema, 'params'),
        validate(ConfirmPhotoSchema, 'body'),
        asyncHandler(async (req, res) => {
            const { id } = req.params as { id: string };
            const updated = await reportsService.attachPhotoKey(id, {
                key: req.body.key,
                kind: req.body.kind,
                timestamp: req.body.timestamp
            });
            res.json(updated);
        })
    );

    // Legacy base64 upload path. Kept so the pre-P3 iOS client can still
    // attach photos — the server uploads to object storage on its behalf.
    router.post(
        '/:id/photos',
        requireAuth,
        validate(ReportIdParamSchema, 'params'),
        validate(UploadPhotoSchema, 'body'),
        asyncHandler(async (req, res) => {
            const { id } = req.params as { id: string };
            const key = await photosService.ingestPhotoString(req.body.dataUrl, {
                reportId: id,
                kind: req.body.kind
            });
            if (!key) {
                res.status(400).json({ error: { code: 'INVALID_PHOTO', message: 'No photo accepted' } });
                return;
            }
            const updated = await reportsService.attachPhotoKey(id, {
                key,
                kind: req.body.kind,
                timestamp: req.body.timestamp
            });
            res.status(201).json(updated);
        })
    );

    return router;
}
