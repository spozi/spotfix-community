import { OAuth2Client, type TokenPayload } from 'google-auth-library';

import { googleClientIds } from '../../config/env';
import { InvalidTokenError } from '../../errors';

/**
 * Verifies a Google-issued ID token (from Google Sign-In on iOS / Web /
 * Android). Audience is pinned to the comma-separated GOOGLE_CLIENT_IDS env;
 * Google's public certs are fetched and cached internally by OAuth2Client.
 */

export interface GoogleIdentity {
    sub: string;
    email: string;
    emailVerified: boolean;
    name?: string;
    picture?: string;
    hostedDomain?: string;
}

const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

// One client is enough — verifyIdToken accepts a per-call audience array.
const oauthClient = new OAuth2Client();

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
    if (googleClientIds.length === 0) {
        throw new InvalidTokenError('Google Sign-In is not configured on this server');
    }
    if (typeof idToken !== 'string' || idToken.trim() === '') {
        throw new InvalidTokenError('Missing Google ID token');
    }

    let payload: TokenPayload | undefined;
    try {
        const ticket = await oauthClient.verifyIdToken({
            idToken,
            audience: googleClientIds
        });
        payload = ticket.getPayload();
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new InvalidTokenError(`Google ID token verification failed: ${msg}`);
    }

    if (!payload) {
        throw new InvalidTokenError('Google ID token has no payload');
    }
    if (!payload.iss || !ISSUERS.has(payload.iss)) {
        throw new InvalidTokenError('Google ID token has unexpected issuer');
    }
    if (!payload.sub) {
        throw new InvalidTokenError('Google ID token missing subject');
    }
    if (!payload.email) {
        throw new InvalidTokenError('Google ID token missing email');
    }
    if (payload.email_verified !== true) {
        throw new InvalidTokenError('Google account email is not verified');
    }

    return {
        sub: payload.sub,
        email: payload.email.toLowerCase(),
        emailVerified: true,
        name: payload.name,
        picture: payload.picture,
        hostedDomain: payload.hd
    };
}
