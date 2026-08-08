import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Wrap an async handler so thrown/rejected errors flow to next(err). */
export function asyncHandler<TReq extends Request = Request>(
    fn: (req: TReq, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
    return (req, res, next) => {
        Promise.resolve(fn(req as TReq, res, next)).catch(next);
    };
}
