import jwt, { type SignOptions } from 'jsonwebtoken';

import { env } from '../../config/env';
import { InvalidTokenError } from '../../errors';
import type { AuthRole, AuthType } from './permissions';

export type TokenUse = 'access' | 'refresh';

export interface TokenPayload {
    sub: string;
    tenantId: string;
    name: string;
    role: AuthRole;
    authType: AuthType;
    sessionVersion: number;
}

export interface DecodedToken extends TokenPayload {
    tokenUse: TokenUse;
    iat: number;
    exp: number;
}

export interface AuthEnvelope {
    accessToken: string;
    refreshToken: string;
    tokenType: 'Bearer';
    expiresIn: string;
    refreshExpiresIn: string;
}

function issueToken(payload: TokenPayload, expiresIn: string, tokenUse: TokenUse): string {
    const options: SignOptions = { expiresIn: expiresIn as SignOptions['expiresIn'] };
    return jwt.sign({ ...payload, tokenUse }, env.JWT_SECRET, options);
}

export function issueAccessToken(payload: TokenPayload): string {
    return issueToken(payload, env.JWT_EXPIRES_IN, 'access');
}

export function issueRefreshToken(payload: TokenPayload): string {
    return issueToken(payload, env.JWT_REFRESH_EXPIRES_IN, 'refresh');
}

function verifyToken(token: string, expected: TokenUse): DecodedToken {
    let decoded: jwt.JwtPayload | string;
    try {
        decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (error) {
        throw new InvalidTokenError('Invalid or expired token');
    }

    if (typeof decoded !== 'object' || decoded === null) {
        throw new InvalidTokenError();
    }

    if ((decoded as { tokenUse?: string }).tokenUse !== expected) {
        throw new InvalidTokenError(`Invalid token type: expected ${expected}`);
    }

    return decoded as DecodedToken;
}

export function verifyAccessToken(token: string): DecodedToken {
    return verifyToken(token, 'access');
}

export function verifyRefreshToken(token: string): DecodedToken {
    return verifyToken(token, 'refresh');
}

export function buildAuthEnvelope(payload: TokenPayload): AuthEnvelope {
    return {
        accessToken: issueAccessToken(payload),
        refreshToken: issueRefreshToken(payload),
        tokenType: 'Bearer',
        expiresIn: env.JWT_EXPIRES_IN,
        refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN
    };
}
