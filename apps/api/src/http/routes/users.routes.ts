import { Router } from 'express';

import { authService } from '../../domain/auth/auth.service';
import { googleAuthService } from '../../domain/auth/google.service';
import { usersService, serializeUserAccount } from '../../domain/users/users.service';
import { usersRepository } from '../../domain/users/users.repository';
import { NotFoundError } from '../../errors';
import { asyncHandler } from '../asyncHandler';
import { requireAuth, requireRoles, requireSelfOrRoles } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimit';
import { requireTenant } from '../middleware/tenant';
import { validate } from '../middleware/validate';
import {
    GoogleSignInSchema,
    ProvisionUserSchema,
    RefreshTokenSchema,
    RegisterPublicSchema,
    UserIdParamSchema,
    UserLoginSchema
} from '../schemas';

export function buildUsersRouter(): Router {
    const router = Router();

    router.post(
        '/register',
        authRateLimiter,
        requireTenant,
        validate(RegisterPublicSchema, 'body'),
        asyncHandler(async (req, res) => {
            const user = await usersService.registerPublic(req.body);
            res.status(201).json(user);
        })
    );

    router.post(
        '/provision',
        requireAuth,
        requireRoles('supervisor', 'master'),
        validate(ProvisionUserSchema, 'body'),
        asyncHandler(async (req, res) => {
            const user = await usersService.provision(req.body, { role: req.auth!.role });
            res.status(201).json(user);
        })
    );

    router.post(
        '/login',
        authRateLimiter,
        requireTenant,
        validate(UserLoginSchema, 'body'),
        asyncHandler(async (req, res) => {
            const { idNumber, email, password } = req.body as {
                idNumber?: string;
                email?: string;
                password: string;
            };
            const { context, envelope } = await authService.loginUser({ idNumber, email }, password);
            const principal = await usersRepository.findById(context.userId);
            if (!principal) throw new NotFoundError('User not found');

            res.json({
                authenticated: true,
                message: 'Login successful',
                ...envelope,
                user: serializeUserAccount(principal)
            });
        })
    );

    router.post(
        '/google',
        authRateLimiter,
        requireTenant,
        validate(GoogleSignInSchema, 'body'),
        asyncHandler(async (req, res) => {
            const { envelope, user, isNew } = await googleAuthService.signIn(req.body.idToken);
            res.status(isNew ? 201 : 200).json({
                authenticated: true,
                message: isNew ? 'Account created via Google' : 'Login successful',
                provider: 'google',
                isNew,
                ...envelope,
                user
            });
        })
    );

    router.post(
        '/refresh',
        authRateLimiter,
        validate(RefreshTokenSchema, 'body'),
        asyncHandler(async (req, res) => {
            const context = await authService.fromRefreshToken(req.body.refreshToken, 'user');
            const envelope = await authService.refresh(context);
            const principal = await usersRepository.findById(context.userId);
            if (!principal) throw new NotFoundError('User not found');

            res.json({
                authenticated: true,
                message: 'Token refreshed successfully',
                ...envelope,
                user: serializeUserAccount(principal)
            });
        })
    );

    router.post(
        '/logout',
        requireAuth,
        requireRoles('public', 'supervisor', 'cleaner'),
        asyncHandler(async (req, res) => {
            await authService.logout(req.auth!);
            res.json({ success: true, message: 'User session revoked successfully' });
        })
    );

    router.get(
        '/',
        requireAuth,
        requireRoles('supervisor', 'master'),
        asyncHandler(async (_req, res) => {
            res.json(await usersService.listAll());
        })
    );

    router.get(
        '/:userId',
        requireAuth,
        validate(UserIdParamSchema, 'params'),
        requireSelfOrRoles('userId', 'supervisor', 'master'),
        asyncHandler(async (req, res) => {
            const { userId } = req.params as { userId: string };
            res.json(await usersService.getPublicProfile(userId));
        })
    );

    return router;
}
