import type { NextFunction, Request, Response } from 'express';

import { authService } from '../../domain/auth/auth.service';
import type { AuthRole } from '../../domain/auth/permissions';
import { AuthRequiredError, ForbiddenError, InvalidTokenError } from '../../errors';

function extractBearerToken(req: Request): string | null {
    const header = req.headers.authorization;
    if (typeof header !== 'string') return null;
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    return match?.[1] ?? null;
}

/** Best-effort: attaches req.auth if a valid Bearer token is provided. */
export function attachAuth(req: Request, _res: Response, next: NextFunction): void {
    const token = extractBearerToken(req);
    if (!token) return next();

    authService
        .fromAccessToken(token)
        .then((context) => {
            req.auth = context;
            next();
        })
        .catch(next);
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
    if (!req.auth) return next(new AuthRequiredError());
    next();
}

export function requireRoles(...roles: AuthRole[]) {
    return (req: Request, _res: Response, next: NextFunction) => {
        if (!req.auth) return next(new AuthRequiredError());
        if (!roles.includes(req.auth.role)) {
            return next(new ForbiddenError('Insufficient role for this resource'));
        }
        next();
    };
}

export function requireSelfOrRoles(idParam: string, ...roles: AuthRole[]) {
    return (req: Request, _res: Response, next: NextFunction) => {
        if (!req.auth) return next(new AuthRequiredError());

        const target = req.params[idParam];
        const isSelf = req.auth.authType === 'user' && target === req.auth.userId;

        if (isSelf || roles.includes(req.auth.role)) {
            return next();
        }

        next(new ForbiddenError('You do not have access to this resource'));
    };
}

export function requireAccessTokenPresent(req: Request, _res: Response, next: NextFunction): void {
    if (!extractBearerToken(req)) {
        return next(new InvalidTokenError('Bearer token is required'));
    }
    next();
}
