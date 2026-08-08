import type { NextFunction, Request, Response } from 'express';

import { enterTenant } from '../../infra/tenant-context';
import { v2AuthService, type V2AuthContext } from '../auth/v2-auth.service';
import {
    InvalidTokenErrorV2,
    UnauthenticatedError,
    ForbiddenRoleError
} from '../errors';
import type { V2Role } from '../auth/roles';

declare module 'express-serve-static-core' {
    interface Request {
        v2Auth?: V2AuthContext;
    }
}

function extractBearer(req: Request): string | null {
    const header = req.headers.authorization;
    if (typeof header !== 'string') return null;
    const m = /^Bearer\s+(.+)$/i.exec(header.trim());
    return m?.[1] ?? null;
}

/**
 * Validates bearer token + DeviceSession on every protected v2 request.
 * Enters tenant scope so downstream prisma calls are tenant-filtered.
 */
export function requireV2Auth(req: Request, _res: Response, next: NextFunction): void {
    const token = extractBearer(req);
    if (!token) return next(new UnauthenticatedError());

    v2AuthService
        .fromAccessToken(token)
        .then((ctx) => {
            req.v2Auth = ctx;
            enterTenant(ctx.tenantId);
            next();
        })
        .catch((err) => {
            // Normalize JWT verify failures into INVALID_TOKEN.
            if (err && typeof err === 'object' && (err as { name?: string }).name === 'JsonWebTokenError') {
                return next(new InvalidTokenErrorV2());
            }
            next(err);
        });
}

export function requireV2Role(role: V2Role) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        if (!req.v2Auth) return next(new UnauthenticatedError());
        if (!req.v2Auth.roles[role]) {
            return next(new ForbiddenRoleError(`This action requires ${role} permission.`));
        }
        next();
    };
}
