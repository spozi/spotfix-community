import rateLimit from 'express-rate-limit';

import { env } from '../../config/env';

export const generalRateLimiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests, please retry later'
        }
    }
});

export const authRateLimiter = rateLimit({
    windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
    max: env.AUTH_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: {
            code: 'RATE_LIMITED',
            message: 'Too many authentication attempts, please retry later'
        }
    }
});
