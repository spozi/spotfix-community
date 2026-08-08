import { Router } from 'express';

import { cleanersService } from '../../domain/cleaners/cleaners.service';
import { asyncHandler } from '../asyncHandler';
import { requireAuth, requireRoles } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
    AssignCleanerSchema,
    CleanerIdParamSchema,
    CleanerListQuerySchema,
    CreateCleanerSchema,
    ReassignCleanerSchema
} from '../schemas';

export function buildCleanersRouter(): Router {
    const router = Router();

    router.get(
        '/',
        requireAuth,
        requireRoles('supervisor', 'master'),
        validate(CleanerListQuerySchema, 'query'),
        asyncHandler(async (req, res) => {
            const result = await cleanersService.list(
                { role: req.auth!.role, userId: req.auth!.userId },
                req.query as { supervisorId?: string; workLocation?: string }
            );
            res.json(result);
        })
    );

    router.post(
        '/',
        requireAuth,
        requireRoles('supervisor', 'master'),
        validate(CreateCleanerSchema, 'body'),
        asyncHandler(async (req, res) => {
            const cleaner = await cleanersService.create(
                { role: req.auth!.role, userId: req.auth!.userId, name: req.auth!.name },
                req.body
            );
            res.status(201).json(cleaner);
        })
    );

    router.patch(
        '/:id/supervisor',
        requireAuth,
        requireRoles('supervisor', 'master'),
        validate(CleanerIdParamSchema, 'params'),
        validate(ReassignCleanerSchema, 'body'),
        asyncHandler(async (req, res) => {
            const { id } = req.params as { id: string };
            const cleaner = await cleanersService.reassignSupervisor(
                { role: req.auth!.role, userId: req.auth!.userId, name: req.auth!.name },
                id,
                req.body.supervisorId
            );
            res.json(cleaner);
        })
    );

    router.post(
        '/:id/assign',
        requireAuth,
        requireRoles('supervisor', 'master'),
        validate(CleanerIdParamSchema, 'params'),
        validate(AssignCleanerSchema, 'body'),
        asyncHandler(async (req, res) => {
            const { id } = req.params as { id: string };
            const cleaner = await cleanersService.assignToReport(
                { role: req.auth!.role, userId: req.auth!.userId, name: req.auth!.name },
                id,
                req.body.reportId,
                req.body.supervisorId
            );
            res.json(cleaner);
        })
    );

    return router;
}
