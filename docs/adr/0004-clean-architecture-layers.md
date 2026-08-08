# 0004 — Clean architecture layers in the API

- Status: Accepted (2026-05-01)
- Phase: P1

## Context

Current Express routes contain HTTP parsing, validation, business rules, and
direct Mongoose calls in the same handler. This makes routes hard to test,
hard to reuse, and bound to MongoDB.

## Decision

Split the API into the following layers under `apps/api/src`:

- `http/routes/` — Express `Router` wiring only.
- `http/controllers/` — request → service → response shaping.
- `http/middleware/` — cross-cutting concerns.
- `http/schemas/` — zod DTOs feeding both validation and OpenAPI generation.
- `domain/<context>/<context>.service.ts` — business rules.
- `domain/<context>/<context>.repository.ts` — persistence boundary
  (Prisma in P2; Mongoose adapter in P1 transition).
- `infra/` — third-party clients (db, storage, mailer).
- `errors.ts` — `AppError` hierarchy + error middleware.

Controllers MUST NOT import Prisma/Mongoose. Services MUST NOT import
`express`. Repositories are the only layer that touches the database.

## Consequences

- Easier testing: services unit-tested with mock repositories.
- The Mongo → Postgres swap (P2) becomes a repository-only change.
- Adds modest indirection — acceptable for a system targeting multi-agency
  scale.
