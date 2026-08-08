import { Router } from 'express';

import { getPermissionsForRole } from '../../domain/auth/permissions';
import { masterRepository } from '../../domain/master/master.repository';
import { serializeUserAccount } from '../../domain/users/users.service';
import { usersRepository } from '../../domain/users/users.repository';
import { NotFoundError } from '../../errors';
import { asyncHandler } from '../asyncHandler';
import { requireAuth } from '../middleware/auth';

export function buildMeRouter(): Router {
    const router = Router();

    router.get(
        '/',
        requireAuth,
        asyncHandler(async (req, res) => {
            const ctx = req.auth!;
            const permissions = getPermissionsForRole(ctx.role);

            if (ctx.authType === 'master') {
                const principal = await masterRepository.findById(ctx.userId);
                if (!principal) throw new NotFoundError('Master profile not found');

                res.json({
                    authenticated: true,
                    auth: {
                        userId: ctx.userId,
                        role: ctx.role,
                        name: ctx.name,
                        authType: ctx.authType
                    },
                    permissions,
                    profile: {
                        _id: principal.id,
                        username: principal.username,
                        name: principal.name,
                        createdAt: principal.createdAt,
                        lastLoginAt: principal.lastLoginAt
                    }
                });
                return;
            }

            const principal = await usersRepository.findById(ctx.userId);
            if (!principal) throw new NotFoundError('User profile not found');

            res.json({
                authenticated: true,
                auth: {
                    userId: ctx.userId,
                    role: ctx.role,
                    name: ctx.name,
                    authType: ctx.authType
                },
                permissions,
                profile: serializeUserAccount(principal)
            });
        })
    );

    return router;
}
