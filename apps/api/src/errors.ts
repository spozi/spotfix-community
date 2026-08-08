/**
 * Typed error hierarchy. Controllers throw these; the error middleware maps
 * them to a stable JSON envelope: { error: { code, message, details, requestId } }.
 *
 * This is the ONLY way HTTP responses surface failures so clients can rely on
 * `error.code` rather than fragile message string matching.
 */

export type AppErrorCode =
    | 'AUTH_REQUIRED'
    | 'INVALID_CREDENTIALS'
    | 'INVALID_TOKEN'
    | 'SESSION_REVOKED'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'CONFLICT'
    | 'VALIDATION_FAILED'
    | 'RATE_LIMITED'
    | 'INTERNAL';

export interface AppErrorOptions {
    code: AppErrorCode;
    status: number;
    message: string;
    details?: unknown;
    cause?: unknown;
}

export class AppError extends Error {
    readonly code: AppErrorCode;
    readonly status: number;
    readonly details: unknown;

    constructor(options: AppErrorOptions) {
        super(options.message);
        this.name = 'AppError';
        this.code = options.code;
        this.status = options.status;
        this.details = options.details;
        if (options.cause !== undefined) {
            (this as { cause?: unknown }).cause = options.cause;
        }
    }
}

export class AuthRequiredError extends AppError {
    constructor(message = 'Authentication is required') {
        super({ code: 'AUTH_REQUIRED', status: 401, message });
    }
}

export class InvalidTokenError extends AppError {
    constructor(message = 'Invalid or expired access token') {
        super({ code: 'INVALID_TOKEN', status: 401, message });
    }
}

export class InvalidCredentialsError extends AppError {
    constructor(message = 'Invalid credentials') {
        super({ code: 'INVALID_CREDENTIALS', status: 401, message });
    }
}

export class SessionRevokedError extends AppError {
    constructor(message = 'Session has been revoked') {
        super({ code: 'SESSION_REVOKED', status: 401, message });
    }
}

export class ForbiddenError extends AppError {
    constructor(message = 'You do not have access to this resource') {
        super({ code: 'FORBIDDEN', status: 403, message });
    }
}

export class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super({ code: 'NOT_FOUND', status: 404, message });
    }
}

export class ConflictError extends AppError {
    constructor(message = 'Resource already exists') {
        super({ code: 'CONFLICT', status: 409, message });
    }
}

export class ValidationError extends AppError {
    constructor(message = 'Validation failed', details?: unknown) {
        super({ code: 'VALIDATION_FAILED', status: 400, message, details });
    }
}
