import type { NextFunction, Request, Response } from 'express';

/**
 * Marks responses to legacy /api/* routes with deprecation headers so
 * clients have a forced migration window to /api/v1/*.
 *
 * The /api alias is kept until Android/iOS clients ship with /api/v1.
 */
export function addDeprecationHeaders(req: Request, res: Response, next: NextFunction): void {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', 'Fri, 31 Dec 2027 23:59:59 GMT');
    const v1Path = req.originalUrl.replace(/^\/api(?!\/v1)/, '/api/v1');
    res.setHeader('Link', `<${v1Path}>; rel="successor-version"`);
    next();
}
