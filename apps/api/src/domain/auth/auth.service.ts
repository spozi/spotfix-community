import { ForbiddenError, InvalidCredentialsError, InvalidTokenError, SessionRevokedError } from '../../errors';
import { masterRepository } from '../master/master.repository';
import { usersRepository } from '../users/users.repository';
import {
    buildAuthEnvelope,
    type AuthEnvelope,
    type DecodedToken,
    verifyAccessToken,
    verifyRefreshToken
} from './jwt';
import { hashPassword, verifyPassword } from './password';
import { normalizeUserRole, type AuthRole, type AuthType } from './permissions';
import { enterTenant } from '../../infra/tenant-context';

export interface AuthContext {
    userId: string;
    tenantId: string;
    role: AuthRole;
    name: string;
    authType: AuthType;
    sessionVersion: number;
}

async function loadAuthContext(decoded: DecodedToken): Promise<AuthContext> {
    if (!decoded.tenantId) {
        throw new InvalidTokenError('Token missing tenant claim');
    }

    // Activate tenant scope so prisma calls below are tenant-filtered.
    enterTenant(decoded.tenantId);

    if (decoded.authType === 'master') {
        const principal = await masterRepository.findById(decoded.sub);
        if (!principal) throw new InvalidTokenError('Authentication subject not found');

        const sessionVersion = Number(principal.sessionVersion ?? 0);
        // Only revoke when the token's sessionVersion is BELOW the stored one
        // (i.e. the user has explicitly logged out since the token was issued).
        // A token with a higher version than the DB happens after a tenant
        // re-seed/restore and should not be treated as revoked, since the
        // signed token itself is still cryptographically valid.
        if (Number(decoded.sessionVersion ?? 0) < sessionVersion) {
            throw new SessionRevokedError();
        }

        return {
            userId: principal.id,
            tenantId: principal.tenantId,
            role: 'master',
            name: principal.name,
            authType: 'master',
            sessionVersion
        };
    }

    if (decoded.authType !== 'user') {
        throw new InvalidTokenError('Unknown auth subject type');
    }

    const principal = await usersRepository.findById(decoded.sub);
    if (!principal) throw new InvalidTokenError('Authentication subject not found');

    const sessionVersion = Number(principal.sessionVersion ?? 0);
    // See loadAuthContext()/master branch above: only "older-than-stored"
    // tokens are considered revoked.
    if (Number(decoded.sessionVersion ?? 0) < sessionVersion) {
        throw new SessionRevokedError();
    }

    if ((principal.status ?? 'active') !== 'active') {
        throw new ForbiddenError('User account is not active');
    }

    return {
        userId: principal.id,
        tenantId: principal.tenantId,
        role: normalizeUserRole(principal.role ?? 'public'),
        name: principal.name,
        authType: 'user',
        sessionVersion
    };
}

export const authService = {
    async fromAccessToken(token: string): Promise<AuthContext> {
        const decoded = verifyAccessToken(token);
        return loadAuthContext(decoded);
    },

    async fromRefreshToken(token: string, expectedAuthType: AuthType): Promise<AuthContext> {
        const decoded = verifyRefreshToken(token);
        if (decoded.authType !== expectedAuthType) {
            throw new InvalidTokenError(`Invalid token: expected ${expectedAuthType} refresh token`);
        }
        return loadAuthContext(decoded);
    },

    /** Tenant context must already be active (set by tenant middleware). */
    async loginUser(
        identifier: { idNumber?: string; email?: string },
        password: string
    ): Promise<{ context: AuthContext; envelope: AuthEnvelope }> {
        const user = identifier.idNumber
            ? await usersRepository.findByIdNumber(identifier.idNumber)
            : identifier.email
                ? await usersRepository.findByEmail(identifier.email.trim().toLowerCase())
                : null;
        if (!user) {
            throw new InvalidCredentialsError();
        }

        const verification = await verifyPassword(password, user.passwordHash);
        if (!verification.matched) {
            throw new InvalidCredentialsError();
        }

        const newPasswordHash = verification.needsRehash ? await hashPassword(password) : undefined;
        await usersRepository.recordLogin(user.id, { newPasswordHash });

        const context: AuthContext = {
            userId: user.id,
            tenantId: user.tenantId,
            role: normalizeUserRole(user.role),
            name: user.name,
            authType: 'user',
            sessionVersion: Number(user.sessionVersion ?? 0)
        };

        const envelope = buildAuthEnvelope({
            sub: context.userId,
            tenantId: context.tenantId,
            name: context.name,
            role: context.role,
            authType: 'user',
            sessionVersion: context.sessionVersion
        });

        return { context, envelope };
    },

    async loginMaster(username: string, password: string): Promise<{ context: AuthContext; envelope: AuthEnvelope }> {
        const master = await masterRepository.findByUsername(username);
        if (!master) {
            throw new InvalidCredentialsError();
        }

        const verification = await verifyPassword(password, master.passwordHash);
        if (!verification.matched) {
            throw new InvalidCredentialsError();
        }

        const newPasswordHash = verification.needsRehash ? await hashPassword(password) : undefined;
        await masterRepository.recordLogin(master.id, { newPasswordHash });

        const context: AuthContext = {
            userId: master.id,
            tenantId: master.tenantId,
            role: 'master',
            name: master.name,
            authType: 'master',
            sessionVersion: Number(master.sessionVersion ?? 0)
        };

        const envelope = buildAuthEnvelope({
            sub: context.userId,
            tenantId: context.tenantId,
            name: context.name,
            role: 'master',
            authType: 'master',
            sessionVersion: context.sessionVersion
        });

        return { context, envelope };
    },

    async refresh(context: AuthContext): Promise<AuthEnvelope> {
        return buildAuthEnvelope({
            sub: context.userId,
            tenantId: context.tenantId,
            name: context.name,
            role: context.role,
            authType: context.authType,
            sessionVersion: context.sessionVersion
        });
    },

    async logout(context: AuthContext): Promise<void> {
        if (context.authType === 'master') {
            await masterRepository.bumpSessionVersion(context.userId);
        } else {
            await usersRepository.bumpSessionVersion(context.userId);
        }
    }
};
