import { Router } from 'express';

import { cleanersService } from '../../domain/cleaners/cleaners.service';
import { usersRepository } from '../../domain/users/users.repository';
import { NotFoundError } from '../../errors';
import { asyncHandler } from '../asyncHandler';
import { requireAuth, requireSelfOrRoles } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { SupervisorIdParamSchema } from '../schemas';

export function buildSupervisorsRouter(): Router {
    const router = Router();

    router.get(
        '/:id/cleaners',
        requireAuth,
        validate(SupervisorIdParamSchema, 'params'),
        requireSelfOrRoles('id', 'master'),
        asyncHandler(async (req, res) => {
            const { id } = req.params as { id: string };
            const supervisor = await usersRepository.findById(id);
            if (!supervisor || supervisor.role !== 'supervisor') {
                throw new NotFoundError('Supervisor not found');
            }

            const cleaners = await cleanersService.list(
                { role: req.auth!.role, userId: req.auth!.userId },
                { supervisorId: supervisor.id }
            );
            res.json(cleaners);
        })
    );

    return router;
}
