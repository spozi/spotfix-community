import { z } from 'zod';

const DEV_DEFAULT_JWT_SECRET = 'dev-only-secret-change-me';
const DEV_DEFAULT_GOOGLE_CLIENT_IDS = '';

const EnvSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(5001),
    HOST: z.string().min(1).default('0.0.0.0'),

    // Database (P2: Postgres via Prisma).
    DATABASE_URL: z.string().min(1).default('postgresql://spotfix:spotfix@127.0.0.1:5432/spotfix?schema=public'),

    // JWT
    JWT_SECRET: z.string().min(1).default(DEV_DEFAULT_JWT_SECRET),
    JWT_EXPIRES_IN: z.string().min(1).default('12h'),
    JWT_REFRESH_EXPIRES_IN: z.string().min(1).default('30d'),

    // CORS — comma-separated; "*" = wildcard (dev only).
    CORS_ALLOWED_ORIGINS: z.string().default('*'),

    // Public API host used by docs/clients in deployed environments.
    PUBLIC_BASE_URL: z.string().optional(),
    OPENAPI_PRIMARY_SERVER_URL: z.string().optional(),
    OPENAPI_DEPRECATED_SERVER_URL: z.string().optional(),

    // Rate limiting (per-IP, per-window). Tunable via env.
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(3000),
    AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(200),

    // JSON body limit. Photos move to object storage in P3; legacy base64
    // upload paths still accept moderately large payloads.
    JSON_BODY_LIMIT: z.string().min(1).default('15mb'),

    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

    // P3 — object storage (MinIO locally, OCI Object Storage / S3 in prod).
    STORAGE_ENDPOINT: z.string().min(1).default('http://127.0.0.1:9000'),
    STORAGE_REGION: z.string().min(1).default('us-east-1'),
    STORAGE_BUCKET: z.string().min(1).default('spotfix-photos'),
    STORAGE_ACCESS_KEY: z.string().min(1).default('spotfix'),
    STORAGE_SECRET_KEY: z.string().min(1).default('spotfix-dev-secret'),
    STORAGE_FORCE_PATH_STYLE: z.enum(['true', 'false']).default('true'),
    STORAGE_PUBLIC_BASE_URL: z.string().optional(),
    STORAGE_PRESIGN_GET_TTL: z.coerce.number().int().positive().default(15 * 60),
    STORAGE_PRESIGN_PUT_TTL: z.coerce.number().int().positive().default(10 * 60),
    STORAGE_MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),

    // P4 — Google Sign-In. Comma-separated list of accepted audiences.
    GOOGLE_CLIENT_IDS: z.string().default(DEV_DEFAULT_GOOGLE_CLIENT_IDS),

    // P10 — Firebase Cloud Messaging (Android push).
    FIREBASE_PROJECT_ID: z.string().optional(),
    FIREBASE_CLIENT_EMAIL: z.string().optional(),
    FIREBASE_PRIVATE_KEY: z.string().optional(),
    FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),

    // Optional single-tenant fallback. When set, requests without
    // `x-tenant-slug` can resolve to this tenant.
    DEFAULT_TENANT_SLUG: z.string().optional()
});

export type AppEnv = z.infer<typeof EnvSchema>;

function parseEnv(): AppEnv {
    const parsed = EnvSchema.safeParse(process.env);

    if (!parsed.success) {
        // Fail fast with a readable error before anything else boots.
        const issues = parsed.error.issues
            .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
            .join('\n');
        // eslint-disable-next-line no-console
        console.error(`Invalid environment configuration:\n${issues}`);
        process.exit(1);
    }

    const env = parsed.data;

    // Hard fail: never boot production with the development JWT fallback.
    if (env.NODE_ENV === 'production' && env.JWT_SECRET === DEV_DEFAULT_JWT_SECRET) {
        // eslint-disable-next-line no-console
        console.error(
            'JWT_SECRET is set to the development default in NODE_ENV=production. ' +
            'Refusing to start. Set JWT_SECRET to a strong random value (>= 64 chars).'
        );
        process.exit(1);
    }

    return env;
}

export const env = parseEnv();

export const corsAllowedOrigins: string[] | '*' = (() => {
    const raw = env.CORS_ALLOWED_ORIGINS.trim();
    if (raw === '' || raw === '*') return '*';
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
})();

export const googleClientIds: string[] = (env.GOOGLE_CLIENT_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

function normalizeBaseUrl(url: string): string {
    return url.replace(/\/+$/, '');
}

export const openApiPrimaryServerUrl =
    env.OPENAPI_PRIMARY_SERVER_URL ??
    (env.PUBLIC_BASE_URL ? `${normalizeBaseUrl(env.PUBLIC_BASE_URL)}/api/v1` : '/api/v1');

export const openApiDeprecatedServerUrl =
    env.OPENAPI_DEPRECATED_SERVER_URL ??
    (env.PUBLIC_BASE_URL ? `${normalizeBaseUrl(env.PUBLIC_BASE_URL)}/api` : '/api');
