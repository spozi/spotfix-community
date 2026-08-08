import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { logger } from '../../config/logger';
import { AppError, type AppErrorCode } from '../../errors';

interface ErrorEnvelope {
    error: {
        code: AppErrorCode;
        message: string;
        details?: unknown;
        requestId: string;
    };
}

function envelope(req: Request, code: AppErrorCode, message: string, details?: unknown): ErrorEnvelope {
    return { error: { code, message, details, requestId: String(req.id) } };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function notFoundHandler(req: Request, res: Response, _next: NextFunction): void {
    res.status(404).json(envelope(req, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
    if (err instanceof AppError) {
        if (err.status >= 500) {
            logger.error({ err, requestId: req.id }, 'request failed');
        } else {
            logger.warn({ code: err.code, status: err.status, requestId: req.id, msg: err.message }, 'request rejected');
        }
        res.status(err.status).json(envelope(req, err.code, err.message, err.details));
        return;
    }

    if (err instanceof ZodError) {
        res.status(400).json(envelope(req, 'VALIDATION_FAILED', 'Request validation failed', err.issues));
        return;
    }

    if (err instanceof SyntaxError && 'body' in err) {
        res.status(400).json(envelope(req, 'VALIDATION_FAILED', 'Malformed JSON body'));
        return;
    }

    logger.error({ err, requestId: req.id }, 'unhandled error');
    res.status(500).json(envelope(req, 'INTERNAL', 'Internal server error'));
}
