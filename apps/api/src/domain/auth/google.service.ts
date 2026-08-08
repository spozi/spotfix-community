import { ConflictError, ForbiddenError } from '../../errors';
import { currentTenantId } from '../../infra/tenant-context';
import { usersRepository, type UserAccountRow } from '../users/users.repository';
import { serializeUserAccount, type SerializedUser } from '../users/users.service';
import { verifyGoogleIdToken, type GoogleIdentity } from './google';
import { buildAuthEnvelope, type AuthEnvelope } from './jwt';
import { normalizeUserRole } from './permissions';

/**
 * P4 — Google Sign-In flow.
 *
 * Responsibility: verify a Google-issued ID token, then resolve / link / create
 * a UserAccount within the currently-active tenant scope, and return the same
 * AuthEnvelope shape that password login emits. Tenant scope MUST already be
 * active (set by tenant middleware) before calling.
 */

export interface GoogleSignInResult {
    envelope: AuthEnvelope;
    user: SerializedUser;
    isNew: boolean;
}

async function resolveOrLink(identity: GoogleIdentity): Promise<{ row: UserAccountRow; isNew: boolean }> {
    const tenantId = currentTenantId();
    if (!tenantId) {
        throw new ForbiddenError('Tenant context is required for Google Sign-In');
    }

    // 1. Match by stable Google subject id first.
    const bySub = await usersRepository.findByGoogleSub(identity.sub);
    if (bySub) {
        if ((bySub.status ?? 'active') !== 'active') {
            throw new ForbiddenError('User account is not active');
        }
        return { row: bySub, isNew: false };
    }

    // 2. Otherwise link by verified email (first-time Google sign-in for a
    //    user that previously registered with a password).
    const byEmail = await usersRepository.findByEmail(identity.email);
    if (byEmail) {
        if ((byEmail.status ?? 'active') !== 'active') {
            throw new ForbiddenError('User account is not active');
        }
        if (byEmail.googleSub && byEmail.googleSub !== identity.sub) {
            throw new ConflictError('Email is already linked to a different Google account');
        }
        await usersRepository.linkGoogle(byEmail.id, {
            googleSub: identity.sub,
            email: identity.email
        });
        return {
            row: { ...byEmail, googleSub: identity.sub, email: identity.email },
            isNew: false
        };
    }

    // 3. Brand-new user — create in current tenant. idNumber is required by
    //    the schema; synthesize a stable, unique value derived from the
    //    Google subject so legacy iOS surfaces still have something to show.
    const synthesizedIdNumber = `g:${identity.sub}`;
    const created = await usersRepository.create({
        name: identity.name?.trim() || identity.email,
        idNumber: synthesizedIdNumber,
        role: 'public',
        passwordHash: null,
        googleSub: identity.sub,
        email: identity.email
    });
    return { row: created, isNew: true };
}

export const googleAuthService = {
    async signIn(idToken: string): Promise<GoogleSignInResult> {
        const identity = await verifyGoogleIdToken(idToken);
        const { row, isNew } = await resolveOrLink(identity);

        await usersRepository.recordLogin(row.id, {});

        const role = normalizeUserRole(row.role);
        const envelope = buildAuthEnvelope({
            sub: row.id,
            tenantId: row.tenantId,
            name: row.name,
            role,
            authType: 'user',
            sessionVersion: Number(row.sessionVersion ?? 0)
        });

        return {
            envelope,
            user: serializeUserAccount(row),
            isNew
        };
    }
};
