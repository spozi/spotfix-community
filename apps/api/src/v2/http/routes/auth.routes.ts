import { Router } from 'express';

import { asyncHandler } from '../../../http/asyncHandler';
import { authRateLimiter } from '../../../http/middleware/rateLimit';
import { requireTenant } from '../../../http/middleware/tenant';
import { v2AuthService } from '../../auth/v2-auth.service';
import { loadUserRoles } from '../../auth/roles';
import { ok } from '../envelope';
import { validateV2 } from '../validate';
import { LoginV2Schema, GoogleLoginV2Schema, LogoutDeviceV2Schema, RefreshV2Schema } from '../schemas';
import { requireV2Auth } from '../auth.middleware';

function serializeUserForAuth(user: {
    id: string;
    name: string;
    email: string | null;
    idNumber: string;
    role: string;
}, roles: { reporter: boolean; supervisor: boolean; cleaner: boolean; admin: boolean }) {
    return {
        id: user.id,
        name: user.name,
        email: user.email ?? undefined,
        id_number: user.idNumber,
        roles,
        default_role: 'reporter' as const
    };
}

export function buildAuthV2Router(): Router {
    const router = Router();

    // POST /api/v2/auth/login
    router.post(
        '/login',
        authRateLimiter,
        requireTenant,
        validateV2(LoginV2Schema, 'body'),
        asyncHandler(async (req, res) => {
            const body = req.body as {
                device_id: string;
                email: string;
                password: string;
            };

            const result = await v2AuthService.loginWithPassword({
                deviceId: body.device_id,
                email: body.email,
                password: body.password
            });

            ok(res, {
                user: serializeUserForAuth(result.user, result.roles),
                device: {
                    id: result.device.id,
                    platform: result.device.platform
                },
                session: {
                    access_token: result.envelope.accessToken,
                    refresh_token: result.envelope.refreshToken,
                    token_type: result.envelope.tokenType,
                    expires_in: result.envelope.expiresIn,
                    refresh_expires_in: result.envelope.refreshExpiresIn
                }
            });
        })
    );

    // POST /api/v2/auth/google
    router.post(
        '/google',
        authRateLimiter,
        requireTenant,
        validateV2(GoogleLoginV2Schema, 'body'),
        asyncHandler(async (req, res) => {
            const body = req.body as { device_id: string; id_token: string };
            const result = await v2AuthService.loginWithGoogle({
                deviceId: body.device_id,
                idToken: body.id_token
            });
            ok(res, {
                user: serializeUserForAuth(result.user, result.roles),
                device: {
                    id: result.device.id,
                    platform: result.device.platform
                },
                session: {
                    access_token: result.envelope.accessToken,
                    refresh_token: result.envelope.refreshToken,
                    token_type: result.envelope.tokenType,
                    expires_in: result.envelope.expiresIn,
                    refresh_expires_in: result.envelope.refreshExpiresIn
                }
            });
        })
    );

    // POST /api/v2/auth/refresh
    router.post(
        '/refresh',
        authRateLimiter,
        validateV2(RefreshV2Schema, 'body'),
        asyncHandler(async (req, res) => {
            const body = req.body as { device_id: string; refresh_token: string };
            const envelope = await v2AuthService.refresh({
                deviceId: body.device_id,
                refreshToken: body.refresh_token
            });
            ok(res, {
                session: {
                    access_token: envelope.accessToken,
                    refresh_token: envelope.refreshToken,
                    token_type: envelope.tokenType,
                    expires_in: envelope.expiresIn,
                    refresh_expires_in: envelope.refreshExpiresIn
                }
            });
        })
    );

    // POST /api/v2/auth/logout-device
    router.post(
        '/logout-device',
        requireV2Auth,
        validateV2(LogoutDeviceV2Schema, 'body'),
        asyncHandler(async (req, res) => {
            const body = req.body as { device_id: string };
            await v2AuthService.logoutDevice({ deviceId: body.device_id });
            ok(res, { message: 'Device session revoked.' });
        })
    );

    return router;
}

export function buildMeV2Router(): Router {
    const router = Router();

    // GET /api/v2/me
    router.get(
        '/',
        requireV2Auth,
        asyncHandler(async (req, res) => {
            const ctx = req.v2Auth!;
            // Re-load roles freshly to reflect any backend-side role changes
            // since the token was issued.
            const { roles, defaultRole } = await loadUserRoles(ctx.userId, null);
            // Merge with the snapshot embedded in the auth context (covers v1 role lift).
            const merged = {
                reporter: true,
                supervisor: ctx.roles.supervisor || roles.supervisor,
                cleaner: ctx.roles.cleaner || roles.cleaner,
                admin: ctx.roles.admin || roles.admin
            };

            ok(res, {
                user: {
                    id: ctx.userId,
                    name: ctx.name,
                    roles: merged,
                    default_role: defaultRole
                },
                device: {
                    id: ctx.deviceId
                }
            });
        })
    );

    return router;
}
