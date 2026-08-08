/**
 * v2 JWT — device-bound tokens.
 *
 * Tokens carry: subject (user id), tenantId, deviceId, deviceSessionId.
 * Access tokens are validated cheaply (signature + tokenUse). The auth
 * middleware additionally checks that the DeviceSession row is still active
 * on every protected request — this is what makes "device-bound" meaningful
 * (logging in on the same device for another account revokes the previous
 * session immediately, not just on token expiry).
 */
import jwt, { type SignOptions } from 'jsonwebtoken';

import { env } from '../../config/env';
import { InvalidTokenErrorV2 } from '../errors';

export const ACCESS_EXPIRES_IN = env.JWT_EXPIRES_IN;
export const REFRESH_EXPIRES_IN = env.JWT_REFRESH_EXPIRES_IN;

export type V2TokenUse = 'access' | 'refresh';

export interface V2TokenPayload {
    sub: string;          // userId
    tenantId: string;
    deviceId: string;
    deviceSessionId: string;
    name: string;
}

export interface V2DecodedToken extends V2TokenPayload {
    tokenUse: V2TokenUse;
    iat: number;
    exp: number;
}

export interface V2AuthEnvelope {
    accessToken: string;
    refreshToken: string;
    tokenType: 'Bearer';
    expiresIn: string;
    refreshExpiresIn: string;
}

function sign(payload: V2TokenPayload, expiresIn: string, tokenUse: V2TokenUse): string {
    const options: SignOptions = { expiresIn: expiresIn as SignOptions['expiresIn'] };
    return jwt.sign({ ...payload, tokenUse, ver: 2 }, env.JWT_SECRET, options);
}

export function issueAccessTokenV2(payload: V2TokenPayload): string {
    return sign(payload, env.JWT_EXPIRES_IN, 'access');
}

export function issueRefreshTokenV2(payload: V2TokenPayload): string {
    return sign(payload, env.JWT_REFRESH_EXPIRES_IN, 'refresh');
}

function verify(token: string, expected: V2TokenUse): V2DecodedToken {
    let decoded: jwt.JwtPayload | string;
    try {
        decoded = jwt.verify(token, env.JWT_SECRET);
    } catch {
        throw new InvalidTokenErrorV2();
    }
    if (typeof decoded !== 'object' || decoded === null) throw new InvalidTokenErrorV2();
    if ((decoded as { tokenUse?: string }).tokenUse !== expected) {
        throw new InvalidTokenErrorV2(`Invalid token type: expected ${expected}`);
    }
    if ((decoded as { ver?: number }).ver !== 2) {
        throw new InvalidTokenErrorV2('Token is not a v2 token');
    }
    const d = decoded as Partial<V2DecodedToken>;
    if (!d.sub || !d.tenantId || !d.deviceId || !d.deviceSessionId) {
        throw new InvalidTokenErrorV2('Token missing required claims');
    }
    return decoded as V2DecodedToken;
}

export function verifyAccessTokenV2(token: string): V2DecodedToken {
    return verify(token, 'access');
}

export function verifyRefreshTokenV2(token: string): V2DecodedToken {
    return verify(token, 'refresh');
}

export function buildAuthEnvelopeV2(payload: V2TokenPayload): V2AuthEnvelope {
    return {
        accessToken: issueAccessTokenV2(payload),
        refreshToken: issueRefreshTokenV2(payload),
        tokenType: 'Bearer',
        expiresIn: env.JWT_EXPIRES_IN,
        refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN
    };
}
