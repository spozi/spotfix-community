# 0001 — PostgreSQL with Prisma

- Status: Accepted (2026-05-01)
- Phase: P2

## Context

Current persistence layer is MongoDB via Mongoose. Schemas are loosely typed
strings, indexes are absent, and foreign-key relationships are emulated with
plain strings (`userId`, `assignedTaskId`, `supervisorId`). The product
roadmap demands multi-agency tenancy, reporting/analytics queries, referential
integrity for assignments, and predictable migrations.

## Decision

Migrate to **PostgreSQL 16** managed through **Prisma** ORM.

## Rationale

- Strong relational integrity for `Report` ↔ `Cleaner` ↔ `User` relationships.
- First-class migrations (`prisma migrate`) replace ad-hoc Mongo edits.
- Type-safe client generated from schema; eliminates the "is this field a
  string or ObjectId" class of bug seen in current routes.
- Easier reporting/analytics + future BI integration.
- Works well on Oracle ARM (Postgres has first-class arm64 builds).

## Alternatives considered

- Stay on MongoDB → no relational guarantees, weak migration story.
- Knex / objection → less type safety, more boilerplate.
- Sequelize → mature, but worse DX and weaker types than Prisma.
- Raw `pg` + node-pg-migrate → too low-level for the team size.

## Consequences

- One-time data migration (Mongo → PG) with dry-run + rollback window.
- Adds Prisma to build/CI; CI must run `prisma generate`.
- Repository layer must enforce `tenantId` (see ADR 0003).
