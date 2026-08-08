# 0003 — Multi-agency tenancy

- Status: Accepted (2026-05-01)
- Phase: P3

## Context

The system was designed for a single agency (Example Campus). The product roadmap calls
for multi-agency deployment so other public-sector bodies can run on the same
codebase without forks.

## Decision

Adopt a **shared-schema, tenant-discriminator** model. Every domain table
carries a non-null `tenantId` column referencing a `Tenant` row. Every JWT
embeds a `tenantId` claim. A Prisma middleware injects
`where: { tenantId: ctx.tenantId }` on every read and sets `tenantId` on every
write, sourced from the authenticated request context.

## Rationale

- Lowest operational cost: one database, one API instance can serve many
  agencies.
- Strong isolation enforced at the data-access layer, not in business code.
- Easy to graduate a tenant to a dedicated database later by exporting only
  rows where `tenantId = X`.

## Alternatives considered

- Schema-per-tenant on Postgres → operational complexity, harder migrations.
- Database-per-tenant → highest isolation, highest cost; revisit if a tenant
  has regulatory data-residency requirements.

## Consequences

- All Prisma models require `tenantId`. All unique constraints must be scoped
  by tenant (e.g. `@@unique([tenantId, idNumber])`).
- Integration tests must include a cross-tenant isolation case.
- Master users are tenant-scoped; a "platform owner" role above tenants is out
  of scope for now.
