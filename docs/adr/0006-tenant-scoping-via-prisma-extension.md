# 0006 — Multi-tenancy enforcement via Prisma client extension

Date: 2026-05-01
Status: Accepted

## Context

ADR 0003 chose a single-database multi-tenant model: every domain row carries a
`tenantId` discriminator. The risk of that model is well known — one missing
`WHERE tenant_id = ?` clause leaks data across agencies. We need a scoping
mechanism that is enforced **once**, centrally, and that repository code
cannot accidentally bypass.

## Decision

- All tenant-scoped Prisma models (`UserAccount`, `MasterUser`, `Cleaner`,
  `Report`) include a `tenantId` column with a compound unique key
  (`@@unique([tenantId, idNumber])`, etc.).
- Tenant id for the current request lives in an `AsyncLocalStorage` store
  ([`infra/tenant-context.ts`](../../apps/api/src/infra/tenant-context.ts)).
- A Prisma client extension ([`infra/prisma.ts`](../../apps/api/src/infra/prisma.ts))
  intercepts every operation against tenant-scoped models and:
  - injects `where.tenantId = <current>` on read/update/delete operations,
  - injects `data.tenantId = <current>` on create/upsert,
  - throws `ForbiddenError` if no tenant context is active.
- Two clients are exported:
  - `prisma` — the extended client; the only one allowed in request handlers.
  - `prismaRaw` — unextended; used by bootstrap, the Mongo→Postgres migration
    script, and the tenant-resolution middleware (which must look up `Tenant`
    by slug before any tenant context exists).
- Tenant resolution at HTTP boundary:
  - Authenticated requests: tenantId comes from the JWT (`tenantId` claim),
    populated by `authService.loadAuthContext`.
  - Unauthenticated routes that need a tenant (login, register,
    `master/login`, `master/create`): tenant is resolved from the
    `X-Tenant-Slug` header by [`http/middleware/tenant.ts`](../../apps/api/src/http/middleware/tenant.ts).
- `findUnique` cannot accept extra `where` columns beyond the unique key.
  Repositories therefore use `findFirst` for all by-id lookups so the extension
  can layer in the tenantId predicate without breaking the call.
- First-tenant + first-master bootstrap goes through `npm run bootstrap`
  (`scripts/bootstrap.ts`), not an HTTP endpoint.
- Existing Mongo data is migrated per-tenant via `npm run migrate:mongo`
  (`scripts/migrate-mongo-to-postgres.ts`); legacy `_id` ObjectIds are not
  preserved — Postgres rows get fresh cuids, and cross-document references
  are rewritten via an in-memory id map during the run.

## Consequences

- A future developer cannot accidentally write a query that ignores tenant
  isolation: the extension throws if no tenant is in scope, and adds the
  predicate if one is.
- Repositories give up `findUnique`-by-pk for `findFirst`; trivial extra cost,
  major safety win.
- API responses still expose the legacy `_id` field (mapped from Prisma `id`)
  and reports still expose their legacy `id` (mapped from `publicId`) so the
  iOS client and the deprecated `/api` alias remain wire-compatible.
- Cross-tenant administrative operations (e.g. a future "super-admin" role)
  must use `prismaRaw` and are not part of P2.
