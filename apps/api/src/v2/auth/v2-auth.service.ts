/**
 * v2 auth service. Implements §9 of android_v2_api_v2.md.
 *
 *   - Login binds the device to exactly one active account session.
 *     If the device already has an active session for any account, that
 *     previous session is revoked before the new one is created.
 *   - Refresh re-issues an access+refresh pair only when the stored
 *     refresh-token hash matches AND the session is still active.
 *   - Logout-device revokes just that device's session (no side effects on
 *     other devices belonging to the same user).
 */
import {
    ConflictError,
    ForbiddenError,
    InvalidCredentialsError
} from '../../errors';
import { verifyGoogleIdToken } from '../../domain/auth/google';
import { verifyPassword } from '../../domain/auth/password';
import { usersRepository, type UserAccountRow } from '../../domain/users/users.repository';
import {
    DeviceNotRegisteredError,
    InvalidTokenErrorV2,
    SessionRevokedErrorV2
} from '../errors';
import {
    ACCESS_EXPIRES_IN,
    REFRESH_EXPIRES_IN,
    issueAccessTokenV2,
    issueRefreshTokenV2,
    verifyAccessTokenV2,
    verifyRefreshTokenV2,
    type V2AuthEnvelope,
    type V2DecodedToken
} from './jwt';
import { devicesV2Repository, type DeviceV2Row } from '../devices/devices.repository';
import {
    deviceSessionsRepository,
    hashRefreshToken
} from '../sessions/sessions.repository';
import { loadUserRoles, type V2RoleSet } from './roles';

export interface V2AuthContext {
    userId: string;
    tenantId: string;
    deviceId: string;
    deviceSessionId: string;
    name: string;
    roles: V2RoleSet;
}

export interface V2LoginResult {
    user: UserAccountRow;
    device: DeviceV2Row;
    sessionId: string;
    envelope: V2AuthEnvelope;
    roles: V2RoleSet;
}

async function issueSessionAndEnvelope(args: {
    user: UserAccountRow;
    device: DeviceV2Row;
}): Promise<{ sessionId: string; envelope: V2AuthEnvelope }> {
    const { user, device } = args;

    // 1. Revoke any prior active session on this device (one-device-one-account).
    await deviceSessionsRepository.revokeAllForDevice(device.id);

    // 2. Pre-create the session row with a placeholder hash so we have an id
    //    to embed in the JWT, then update with the real refresh-token hash.
    const placeholder = await deviceSessionsRepository.create({
        deviceId: device.id,
        userId: user.id,
        refreshTokenHash: 'pending'
    });

    const tokenPayload = {
        sub: user.id,
        tenantId: user.tenantId,
        deviceId: device.id,
        deviceSessionId: placeholder.id,
        name: user.name
    };
    const accessToken = issueAccessTokenV2(tokenPayload);
    const refreshToken = issueRefreshTokenV2(tokenPayload);

    await deviceSessionsRepository.updateRefreshToken(
        placeholder.id,
        hashRefreshToken(refreshToken)
    );
    await devicesV2Repository.bindToUser(device.id, user.id);

    const envelope: V2AuthEnvelope = {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: ACCESS_EXPIRES_IN,
        refreshExpiresIn: REFRESH_EXPIRES_IN
    };

    return { sessionId: placeholder.id, envelope };
}

export const v2AuthService = {
    async loginWithPassword(input: {
        deviceId: string;
        email: string;
        password: string;
    }): Promise<V2LoginResult> {
        const device = await devicesV2Repository.findById(input.deviceId);
        if (!device || !device.isActive) {
            throw new DeviceNotRegisteredError();
        }

        const user = await usersRepository.findByEmail(input.email.trim().toLowerCase());
        if (!user) throw new InvalidCredentialsError();

        const verification = await verifyPassword(input.password, user.passwordHash);
        if (!verification.matched) throw new InvalidCredentialsError();

        await usersRepository.recordLogin(user.id, {});

        const { sessionId, envelope } = await issueSessionAndEnvelope({ user, device });
        const { roles } = await loadUserRoles(user.id, user.role);

        return { user, device, sessionId, envelope, roles };
    },

    /**
     * Google Sign-In for v2: verifies the Google id token, links / creates the
     * matching UserAccount in the device's tenant, then issues a device-bound
     * session in the same shape as password login.
     */
    async loginWithGoogle(input: {
        deviceId: string;
        idToken: string;
    }): Promise<V2LoginResult> {
        const device = await devicesV2Repository.findById(input.deviceId);
        if (!device || !device.isActive) {
            throw new DeviceNotRegisteredError();
        }

        const identity = await verifyGoogleIdToken(input.idToken);

        // 1. Existing link by google subject.
        let user = await usersRepository.findByGoogleSub(identity.sub);

        // 2. Otherwise link by verified email.
        if (!user) {
            const byEmail = await usersRepository.findByEmail(identity.email);
            if (byEmail) {
                if (byEmail.googleSub && byEmail.googleSub !== identity.sub) {
                    throw new ConflictError(
                        'Email is already linked to a different Google account'
                    );
                }
                if ((byEmail.status ?? 'active') !== 'active') {
                    throw new ForbiddenError('User account is not active');
                }
                await usersRepository.linkGoogle(byEmail.id, {
                    googleSub: identity.sub,
                    email: identity.email
                });
                user = { ...byEmail, googleSub: identity.sub, email: identity.email };
            }
        }

        // 3. Brand-new user — create in the device's tenant.
        if (!user) {
            user = await usersRepository.create({
                name: identity.name?.trim() || identity.email,
                idNumber: `g:${identity.sub}`,
                role: 'public',
                passwordHash: null,
                googleSub: identity.sub,
                email: identity.email
            });
        }

        if ((user.status ?? 'active') !== 'active') {
            throw new ForbiddenError('User account is not active');
        }

        await usersRepository.recordLogin(user.id, {});

        const { sessionId, envelope } = await issueSessionAndEnvelope({ user, device });
        const { roles } = await loadUserRoles(user.id, user.role);

        return { user, device, sessionId, envelope, roles };
    },

    async refresh(input: { deviceId: string; refreshToken: string }): Promise<V2AuthEnvelope> {
        let decoded: V2DecodedToken;
        try {
            decoded = verifyRefreshTokenV2(input.refreshToken);
        } catch {
            throw new InvalidTokenErrorV2();
        }

        if (decoded.deviceId !== input.deviceId) {
            throw new InvalidTokenErrorV2('Refresh token does not match this device.');
        }

        const session = await deviceSessionsRepository.findActiveById(decoded.deviceSessionId);
        if (!session) throw new SessionRevokedErrorV2();

        if (session.refreshTokenHash !== hashRefreshToken(input.refreshToken)) {
            // Stale or stolen refresh token — revoke the session as a precaution.
            await deviceSessionsRepository.revoke(session.id);
            throw new SessionRevokedErrorV2();
        }

        const user = await usersRepository.findById(decoded.sub);
        if (!user) throw new InvalidTokenErrorV2('User not found.');

        const tokenPayload = {
            sub: user.id,
            tenantId: user.tenantId,
            deviceId: session.deviceId,
            deviceSessionId: session.id,
            name: user.name
        };

        const accessToken = issueAccessTokenV2(tokenPayload);
        const refreshToken = issueRefreshTokenV2(tokenPayload);
        await deviceSessionsRepository.updateRefreshToken(session.id, hashRefreshToken(refreshToken));

        const envelope: V2AuthEnvelope = {
            accessToken,
            refreshToken,
            tokenType: 'Bearer',
            expiresIn: ACCESS_EXPIRES_IN,
            refreshExpiresIn: REFRESH_EXPIRES_IN
        };

        return envelope;
    },

    async logoutDevice(input: { deviceId: string }): Promise<void> {
        await deviceSessionsRepository.revokeAllForDevice(input.deviceId);
    },

    /**
     * Validate an access token for an authenticated v2 request. In addition to
     * the JWT signature check, this verifies the underlying DeviceSession is
     * still active — which is what enforces "device-bound session" semantics
     * (e.g. another login on the same device immediately invalidates this one).
     */
    async fromAccessToken(token: string): Promise<V2AuthContext> {
        const decoded = verifyAccessTokenV2(token);

        const session = await deviceSessionsRepository.findActiveById(decoded.deviceSessionId);
        if (!session) throw new SessionRevokedErrorV2();
        if (session.deviceId !== decoded.deviceId || session.userId !== decoded.sub) {
            throw new SessionRevokedErrorV2();
        }

        const user = await usersRepository.findById(decoded.sub);
        if (!user) throw new InvalidTokenErrorV2('User not found.');

        const { roles } = await loadUserRoles(user.id, user.role);

        // Best-effort touch — not awaited.
        void deviceSessionsRepository.touch(session.id);

        return {
            userId: user.id,
            tenantId: user.tenantId,
            deviceId: session.deviceId,
            deviceSessionId: session.id,
            name: user.name,
            roles
        };
    }
};
