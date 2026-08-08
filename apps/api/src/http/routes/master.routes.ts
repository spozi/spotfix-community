import { Router } from 'express';

import { authService } from '../../domain/auth/auth.service';
import { masterRepository } from '../../domain/master/master.repository';
import { masterService, serializeMaster } from '../../domain/master/master.service';
import { NotFoundError } from '../../errors';
import { asyncHandler } from '../asyncHandler';
import { attachAuth, requireAuth, requireRoles } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimit';
import { requireTenant } from '../middleware/tenant';
import { validate } from '../middleware/validate';
import { CreateMasterSchema, MasterLoginSchema, RefreshTokenSchema } from '../schemas';

export function buildMasterRouter(): Router {
    const router = Router();

    router.post(
        '/login',
        authRateLimiter,
        requireTenant,
        validate(MasterLoginSchema, 'body'),
        asyncHandler(async (req, res) => {
            const { username, password } = req.body;
            const { context, envelope } = await authService.loginMaster(username, password);
            const principal = await masterRepository.findById(context.userId);
            if (!principal) throw new NotFoundError('Master not found');

            res.json({
                success: true,
                message: 'Master login successful',
                ...envelope,
                user: serializeMaster(principal)
            });
        })
    );

    router.post(
        '/refresh',
        authRateLimiter,
        validate(RefreshTokenSchema, 'body'),
        asyncHandler(async (req, res) => {
            const context = await authService.fromRefreshToken(req.body.refreshToken, 'master');
            const envelope = await authService.refresh(context);
            const principal = await masterRepository.findById(context.userId);
            if (!principal) throw new NotFoundError('Master not found');

            res.json({
                success: true,
                message: 'Master token refreshed successfully',
                ...envelope,
                user: serializeMaster(principal)
            });
        })
    );

    router.post(
        '/logout',
        requireAuth,
        requireRoles('master'),
        asyncHandler(async (req, res) => {
            await authService.logout(req.auth!);
            res.json({ success: true, message: 'Master session revoked successfully' });
        })
    );

    router.post(
        '/create',
        attachAuth,
        requireTenant,
        validate(CreateMasterSchema, 'body'),
        asyncHandler(async (req, res) => {
            const created = await masterService.create(req.body, req.auth ? { role: req.auth.role } : null);
            res.status(201).json({
                success: true,
                message: 'Master user created successfully',
                user: created
            });
        })
    );

    return router;
}
