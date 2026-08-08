# SpotFix Community API

Express and TypeScript API backed by PostgreSQL through Prisma and by
S3-compatible object storage for photos.

## Commands

```bash
npm ci
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Validation:

```bash
npm run typecheck
npm test
npm run build
```

The supported v1 API is mounted at `/api/v1`; OpenAPI is served from
`/api/v1/openapi.json`. The `/api/v2` implementation is experimental.

All unauthenticated tenant-aware endpoints require `X-Tenant-Slug` unless
`DEFAULT_TENANT_SLUG` is configured. Never use the development JWT or storage
credentials in production.
