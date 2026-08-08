import cors from 'cors';
import express, { type Request, type Response } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';

import { corsAllowedOrigins, env } from './config/env';
import { logger } from './config/logger';
import { addDeprecationHeaders } from './http/middleware/deprecation';
import { errorHandler, notFoundHandler } from './http/middleware/error';
import { generalRateLimiter } from './http/middleware/rateLimit';
import { requestId } from './http/middleware/requestId';
import { buildV1Router } from './http/routes';
import { openApiSpec, renderSwaggerUi } from './openapi';
import { buildV2Router } from './v2/http/routes';

// Side-effect import: augments Express.Request with `id` and `auth`.
import './http/types';

export function createApp(): express.Express {
    const app = express();

    app.disable('x-powered-by');
    app.set('trust proxy', 1);

    app.use(requestId);
    app.use(
        pinoHttp({
            logger,
            customProps: (req) => ({ requestId: (req as Request).id }),
            serializers: {
                req: (req) => ({
                    id: req.id,
                    method: req.method,
                    url: req.url,
                    remoteAddress: req.remoteAddress
                })
            }
        })
    );

    app.use(helmet({ crossOriginResourcePolicy: false }));
    app.use(
        cors({
            origin: corsAllowedOrigins === '*' ? true : corsAllowedOrigins,
            credentials: true
        })
    );
    app.use(express.json({ limit: env.JSON_BODY_LIMIT }));

    app.use(generalRateLimiter);

    // Liveness/health (no auth, no rate-limit pressure).
    app.get('/health', (_req: Request, res: Response) => {
        res.json({ status: 'ok', service: 'spotfix-community-api' });
    });

    // Convenience redirects so existing dev URLs keep working.
    app.get('/docs', (_req, res) => res.redirect('/api/v1/docs'));
    app.get('/openapi.json', (_req, res) => res.redirect('/api/v1/openapi.json'));

    // v1 surface (canonical) + /api alias (deprecated).
    const v1 = buildV1Router();
    const v1Meta = express.Router();
    v1Meta.get('/', (_req, res) => {
        res.json({
            name: 'SpotFix Community API',
            version: 'v1',
            mode: 'api-only',
            supportedVersions: ['v1']
        });
    });
    // Health check mounted on v1Meta (before v1 router) so it never runs tenant
    // middleware — safe to call even before DB migrations have been applied.
    v1Meta.get('/health', (_req, res) => {
        res.json({ status: 'ok', service: 'spotfix-community-api', version: 'v1' });
    });
    v1Meta.get('/openapi.json', (_req, res) => res.json(openApiSpec));
    v1Meta.get('/docs', (_req, res) => {
        // Docs is a developer tool — remove CSP so Swagger UI (CDN scripts + blob workers) renders correctly.
        res.removeHeader('Content-Security-Policy');
        res.type('html').send(renderSwaggerUi('/api/v1/openapi.json'));
    });

    app.use('/api/v1', v1Meta, v1);

    // v2 surface — independent router with its own envelope + error middleware.
    app.use('/api/v2', buildV2Router());

    // Deprecated root: respond with redirect WITHOUT running tenant middleware.
    // Keeps old clients from hitting a 500 when /api is called with no sub-path.
    app.get('/api', addDeprecationHeaders, (_req, res) => {
        res.redirect(301, '/api/v1');
    });
    app.use('/api', addDeprecationHeaders, v1);

    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
