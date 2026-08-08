import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

import { ValidationError } from '../../errors';

type Source = 'body' | 'query' | 'params';

/**
 * Parses a request segment with the provided zod schema and replaces it with
 * the parsed (typed) value. Throws ValidationError on failure so the central
 * error middleware produces our standard envelope.
 */
export function validate(schema: ZodSchema<unknown>, source: Source = 'body') {
    return (req: Request, _res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req[source]);
        if (!result.success) {
            return next(new ValidationError('Request validation failed', result.error.issues));
        }
        // Replace with parsed value so downstream sees coerced/transformed data.
        // In newer Node/Express stacks, req.query can be getter-only; defining
        // the property avoids runtime TypeError when direct assignment fails.
        if (source === 'query') {
            Object.defineProperty(req, 'query', {
                value: result.data,
                writable: true,
                configurable: true,
                enumerable: true
            });
        } else {
            (req[source] as unknown) = result.data;
        }
        next();
    };
}
