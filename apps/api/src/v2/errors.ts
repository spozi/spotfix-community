/**
 * API v2 error model.
 *
 * v2 uses a different error envelope and a different error-code vocabulary
 * than v1. See android_v2_api_v2.md §8.3.
 *
 * v1 surface (src/errors.ts) is untouched.
 */

export type V2ErrorCode =
    | 'UNAUTHENTICATED'
    | 'INVALID_TOKEN'
    | 'SESSION_REVOKED'
    | 'FORBIDDEN_ROLE'
    | 'VALIDATION_ERROR'
    | 'REPORT_NOT_FOUND'
    | 'DEVICE_NOT_REGISTERED'
    | 'CONFLICT_STALE_VERSION'
    | 'NOT_FOUND'
    | 'CONFLICT'
    | 'INTERNAL_ERROR';

export interface V2ErrorOptions {
    code: V2ErrorCode;
    status: number;
    message: string;
    details?: unknown;
}

export class V2Error extends Error {
    readonly code: V2ErrorCode;
    readonly status: number;
    readonly details?: unknown;

    constructor(opts: V2ErrorOptions) {
        super(opts.message);
        this.name = 'V2Error';
        this.code = opts.code;
        this.status = opts.status;
        this.details = opts.details;
    }
}

export class UnauthenticatedError extends V2Error {
    constructor(message = 'Authentication is required.') {
        super({ code: 'UNAUTHENTICATED', status: 401, message });
    }
}

export class InvalidTokenErrorV2 extends V2Error {
    constructor(message = 'Invalid or expired access token.') {
        super({ code: 'INVALID_TOKEN', status: 401, message });
    }
}

export class SessionRevokedErrorV2 extends V2Error {
    constructor(message = 'Session has been revoked.') {
        super({ code: 'SESSION_REVOKED', status: 401, message });
    }
}

export class ForbiddenRoleError extends V2Error {
    constructor(message = 'This action requires a different role.') {
        super({ code: 'FORBIDDEN_ROLE', status: 403, message });
    }
}

export class V2ValidationError extends V2Error {
    constructor(message = 'Request validation failed.', details?: unknown) {
        super({ code: 'VALIDATION_ERROR', status: 400, message, details });
    }
}

export class DeviceNotRegisteredError extends V2Error {
    constructor(message = 'Device is not registered.') {
        super({ code: 'DEVICE_NOT_REGISTERED', status: 400, message });
    }
}

export class ReportNotFoundError extends V2Error {
    constructor(message = 'Report not found.') {
        super({ code: 'REPORT_NOT_FOUND', status: 404, message });
    }
}

export class StaleVersionError extends V2Error {
    constructor(message = 'The report has been updated. Please refresh before continuing.') {
        super({ code: 'CONFLICT_STALE_VERSION', status: 409, message });
    }
}

export class V2NotFoundError extends V2Error {
    constructor(message = 'Resource not found.') {
        super({ code: 'NOT_FOUND', status: 404, message });
    }
}

export class V2ConflictError extends V2Error {
    constructor(message = 'Resource already exists.') {
        super({ code: 'CONFLICT', status: 409, message });
    }
}
