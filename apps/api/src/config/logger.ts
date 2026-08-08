import pino from 'pino';

import { env } from './env';

export const logger = pino({
    level: env.LOG_LEVEL,
    base: { service: 'spotfix-community-api' },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
        paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'res.headers["set-cookie"]',
            '*.password',
            '*.passwordHash',
            '*.refreshToken',
            '*.accessToken'
        ],
        censor: '[redacted]'
    },
    transport:
        env.NODE_ENV === 'development'
            ? {
                target: 'pino/file',
                options: { destination: 1 }
            }
            : undefined
});

export type Logger = typeof logger;
