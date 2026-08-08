# Architecture

SpotFix Community is a multi-tenant facility reporting system with three
supported runtime components:

```text
Web portal ─────┐
                ├── HTTPS / JSON ── API ── PostgreSQL
Android app ────┘                    └───── S3-compatible photo storage
```

## API boundaries

- `http/routes` handles HTTP routing and validation for v1.
- `domain` contains v1 services and repositories.
- `infra` owns Prisma, tenant context and object storage.
- `openapi` derives the v1 specification from Zod schemas.
- `v2` is an experimental, separately versioned surface.

Authenticated requests carry tenant identity in their signed token.
Unauthenticated tenant-aware requests use `X-Tenant-Slug`. Repository queries
must preserve tenant isolation; this is a security boundary, not merely a
filtering convenience.

## Client boundaries

The web and Android applications own presentation state but treat the API as
the source of truth. Authentication tokens are persisted in platform-appropriate
storage. Client DTOs should remain aligned with OpenAPI contract tests.

## Deployment

The local stack uses PostgreSQL and MinIO. Production deployments must inject
secrets through their hosting platform, terminate TLS, restrict CORS, configure
backups and use externally managed credentials.
