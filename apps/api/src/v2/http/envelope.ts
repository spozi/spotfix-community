/**
 * v2 response envelope helpers — see android_v2_api_v2.md §8.
 */
import type { Response } from 'express';

export interface SuccessEnvelope<T = unknown> {
    success: true;
    data: T;
    meta?: Record<string, unknown>;
}

export interface ErrorEnvelope {
    success: false;
    error: {
        code: string;
        message: string;
        details?: unknown;
        requestId?: string;
    };
}

export function ok<T>(res: Response, data: T, meta?: Record<string, unknown>): Response {
    const body: SuccessEnvelope<T> = { success: true, data };
    if (meta) body.meta = meta;
    return res.json(body);
}

export function created<T>(res: Response, data: T, meta?: Record<string, unknown>): Response {
    const body: SuccessEnvelope<T> = { success: true, data };
    if (meta) body.meta = meta;
    return res.status(201).json(body);
}
