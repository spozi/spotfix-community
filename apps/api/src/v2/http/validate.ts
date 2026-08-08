import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

import { V2ValidationError } from '../errors';

type Source = 'body' | 'query' | 'params';

export function validateV2(schema: ZodSchema<unknown>, source: Source = 'body') {
    return (req: Request, _res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req[source]);
        if (!result.success) {
            return next(new V2ValidationError('Request validation failed', result.error.issues));
        }
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
