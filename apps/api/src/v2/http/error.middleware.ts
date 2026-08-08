import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { logger } from '../../config/logger';
import { AppError } from '../../errors';
import { V2Error, type V2ErrorCode } from '../errors';

interface V2ErrorEnvelope {
    success: false;
    error: {
        code: V2ErrorCode;
        message: string;
        details?: unknown;
        requestId: string;
    };
}

function envelope(req: Request, code: V2ErrorCode, message: string, details?: unknown): V2ErrorEnvelope {
    return { success: false, error: { code, message, details, requestId: String(req.id ?? '') } };
}

// Map v1 AppError codes onto v2 vocabulary so existing services thrown from
// shared layers (auth/prisma/etc.) surface with v2-flavoured codes.
function mapAppErrorCode(code: string): V2ErrorCode {
    switch (code) {
    case 'AUTH_REQUIRED':
        return 'UNAUTHENTICATED';
    case 'INVALID_TOKEN':
        return 'INVALID_TOKEN';
    case 'INVALID_CREDENTIALS':
        return 'UNAUTHENTICATED';
    case 'SESSION_REVOKED':
        return 'SESSION_REVOKED';
    case 'FORBIDDEN':
        return 'FORBIDDEN_ROLE';
    case 'NOT_FOUND':
        return 'NOT_FOUND';
    case 'CONFLICT':
        return 'CONFLICT';
    case 'VALIDATION_FAILED':
        return 'VALIDATION_ERROR';
    case 'RATE_LIMITED':
        return 'VALIDATION_ERROR';
    default:
        return 'INTERNAL_ERROR';
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function v2NotFoundHandler(req: Request, res: Response, _next: NextFunction): void {
    res.status(404).json(envelope(req, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function v2ErrorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
    if (err instanceof V2Error) {
        if (err.status >= 500) {
            logger.error({ err, requestId: req.id }, 'v2 request failed');
        } else {
            logger.warn(
                { code: err.code, status: err.status, requestId: req.id, msg: err.message },
                'v2 request rejected'
            );
        }
        res.status(err.status).json(envelope(req, err.code, err.message, err.details));
        return;
    }

    if (err instanceof AppError) {
        const code = mapAppErrorCode(err.code);
        if (err.status >= 500) {
            logger.error({ err, requestId: req.id }, 'v2 request failed (AppError)');
        } else {
            logger.warn({ code, status: err.status, requestId: req.id, msg: err.message }, 'v2 request rejected (AppError)');
        }
        res.status(err.status).json(envelope(req, code, err.message, err.details));
        return;
    }

    if (err instanceof ZodError) {
        res.status(400).json(envelope(req, 'VALIDATION_ERROR', 'Request validation failed', err.issues));
        return;
    }

    if (err instanceof SyntaxError && 'body' in err) {
        res.status(400).json(envelope(req, 'VALIDATION_ERROR', 'Malformed JSON body'));
        return;
    }

    logger.error({ err, requestId: req.id }, 'v2 unhandled error');
    res.status(500).json(envelope(req, 'INTERNAL_ERROR', 'Internal server error'));
}
