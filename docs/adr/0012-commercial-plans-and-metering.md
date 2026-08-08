# 0012 — Commercial plans, entitlements and metering

Date: 2026-08-08
Status: Proposed

## Context

`ROADMAP.md` reserves a commercial boundary around the Apache-2.0 community
edition. Nothing in the schema supports it yet. `Tenant` carries only `id`,
`slug`, `name`, `status` and `createdAt` — there is no plan, no seat limit, no
quota and no usage counter, so no deployment is billable and no feature can be
gated.

Two existing decisions constrain the design:

- ADR 0003 chose a shared-schema tenant-discriminator model and explicitly put
  "a platform owner role above tenants" out of scope.
- ADR 0006 enforces tenancy in a Prisma client extension that injects
  `tenantId` into every query against a model listed in `TENANT_SCOPED_MODELS`,
  and throws `ForbiddenError` when no tenant context is active.

Billing is inherently cross-tenant: an operator lists all subscriptions, sums
usage across tenants, and reconciles against a payment provider. That is
precisely the access pattern ADR 0006 is designed to prevent. Getting this
boundary wrong either breaks billing or punches a hole in tenant isolation.

## Decision

### Platform scope, distinct from tenant scope

Introduce a **platform scope** above tenants, reversing the deferral in ADR
0003. Platform-scope models are *not* added to `TENANT_SCOPED_MODELS` and are
reached only through `prismaRaw`, from a dedicated `domain/billing` module that
request handlers may not import directly.

Access is split by direction:

- **Read-down** (a tenant reading its own entitlements) goes through a
  tenant-scoped service that resolves the current tenant's subscription and
  caches it on the request context. Safe, common, hot path.
- **Read-across** (an operator listing or aggregating over tenants) is
  restricted to a `PlatformOperator` principal, authenticated separately from
  tenant users, and never reachable from the tenant-facing API surface.

`PlatformOperator` is a new principal type, not a role on `UserAccount`. A
tenant master must never be able to escalate into it by editing a role column.

### Models

Additive only, per the migration rule in `CONTRIBUTING.md`.

```prisma
/// Platform scope — NOT tenant-scoped. Access via prismaRaw only.
model Plan {
  id           String   @id @default(cuid())
  key          String   @unique // "community", "campus", "district"
  name         String
  description  String?
  isPublic     Boolean  @default(true)
  // Entitlement defaults. Null limit = unlimited.
  features     Json     @default("{}") // { "sso": true, "auditLog": true }
  maxStaffSeats     Int?
  maxReportsPerMonth Int?
  maxStorageBytes   BigInt?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  subscriptions Subscription[]
}

/// Platform scope. One active subscription per tenant.
model Subscription {
  id        String   @id @default(cuid())
  tenantId  String   @unique
  planId    String
  status    String   @default("trialing") // trialing|active|past_due|canceled
  seatsPurchased Int  @default(0)
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  trialEndsAt        DateTime?
  cancelAt           DateTime?
  /// Opaque payment-provider reference. No card data is ever stored here.
  externalRef        String?  @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  plan   Plan   @relation(fields: [planId], references: [id])

  @@index([status, currentPeriodEnd])
}

/// Platform scope. Per-tenant override of a plan default.
/// Needed for design partners and negotiated enterprise terms.
model TenantEntitlement {
  id        String   @id @default(cuid())
  tenantId  String
  key       String   // "sso", "maxStaffSeats"
  value     Json
  expiresAt DateTime?
  note      String?  // why this override exists
  createdAt DateTime @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, key])
}

/// Platform scope. Append-only. One row per tenant per metric per period.
model UsageCounter {
  id        String   @id @default(cuid())
  tenantId  String
  metric    String   // "reports.created" | "storage.bytes" | "seats.active"
  period    String   // "2026-08" for monthly, "2026-08-08" for daily
  value     BigInt   @default(0)
  updatedAt DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, metric, period])
  @@index([metric, period])
}
```

`Tenant` gains only back-relations plus an optional `billingEmail String?`. The
model stays lean; commercial state lives in its own tables so the community
edition can ignore them entirely.

### Entitlement resolution and the open-core seam

Resolution order, first match wins: **unexpired `TenantEntitlement` → `Plan`
default → built-in fallback**.

The resolver interface and every call site live in the Apache-2.0 core, behind
one port:

```ts
interface EntitlementResolver {
  can(feature: string): Promise<boolean>;
  limit(key: string): Promise<number | null>; // null = unlimited
}
```

The community edition ships `UnlimitedEntitlementResolver`, which grants
everything. The commercial edition supplies a resolver backed by the models
above. This follows the adapter pattern `ROADMAP.md` already prescribes for
identity, messaging, storage and maps.

This seam is deliberate: **self-hosting stays fully functional and ungated.**
The paid product is the managed service and the enterprise adapters, not a
crippled core. Gating the community edition would be trivially patched around
anyway, since the enforcement code is open by construction.

### Metering

Meter four metrics, chosen because each maps to real cost or real value:

| Metric | Written at | Why |
| --- | --- | --- |
| `reports.created` | report create service | primary value metric |
| `storage.bytes` | photo upload/delete | tracks actual S3 cost |
| `seats.active` | nightly job | drives seat-band billing |
| `notifications.sent` | notification dispatch | tracks FCM cost |

Counters increment via an atomic `upsert` on `@@unique([tenantId, metric,
period])` so concurrent writes cannot lose increments. Metering is **advisory**:
a failed counter write is logged and swallowed, never propagated. Billing
telemetry must not be able to fail a facilities report — a field worker
photographing a burst pipe is not blocked because a counter row deadlocked.

Quota enforcement, where a plan sets one, happens at the service boundary
before the write, and returns a distinct `QuotaExceededError` (HTTP 402) so
clients can present an upgrade path rather than a generic failure.

## Rationale

- Separating platform scope from tenant scope preserves ADR 0006's guarantee
  intact. Adding billing models to `TENANT_SCOPED_MODELS` would make
  cross-tenant aggregation impossible; adding them *unscoped but reachable from
  tenant handlers* would breach isolation. The split does neither.
- Storing entitlement overrides separately from plans means a negotiated deal
  never requires inventing a bespoke plan row, which is what turns pricing
  tables into unmaintainable sprawl.
- `BigInt` for storage and counters avoids a silent overflow at ~2GB that
  `Int` would hit almost immediately on a photo-heavy workload.
- Keeping payment-provider state to one opaque `externalRef` keeps card data
  and PCI scope entirely outside this system.

## Alternatives considered

- **Plan columns directly on `Tenant`** — simplest, but every pricing change
  becomes a migration, and per-tenant negotiated terms have nowhere to live.
- **Entitlements in the JWT** — fast, no per-request lookup, but a downgrade or
  cancellation only takes effect at token expiry, and token size grows with the
  feature list.
- **Billing in a separate service and database** — cleanest isolation, correct
  eventual destination, but premature at current scale and it forfeits
  transactional consistency between quota checks and writes.
- **Event-sourced usage rows instead of counters** — exact and auditable, but
  aggregation cost grows without bound. Revisit if disputed invoices make an
  audit trail necessary; a daily-granularity `period` already softens this.

## Consequences

- ADR 0003's "platform owner out of scope" no longer holds. `PlatformOperator`
  authentication, and its complete absence from the tenant-facing API surface,
  needs its own security review before launch.
- Integration tests must add: a cross-tenant isolation case for the new models,
  a concurrent-increment case for `UsageCounter`, and a case proving a tenant
  master cannot reach platform scope.
- The community edition carries billing tables it never populates. Acceptable —
  the alternative is diverging schemas between editions, which makes managed-to
  -self-hosted migration a rewrite.
- Seat counting must define "active" precisely across `UserAccount`,
  `MasterUser` and `Cleaner`. That definition is a pricing decision, not an
  engineering one, and must be settled before the nightly job is written.
- Nothing here is enforceable revenue on its own. It makes billing *possible*;
  the licensing question in `CLA.md` and the admin web portal gap remain the
  blocking items.
