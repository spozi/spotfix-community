# ADR 0010 — Generate OpenAPI from zod; ship typed SDK (P6)

Status: Accepted (P6)
Builds on: ADR 0001 (Postgres+Prisma) — informally: API contracts derive from
runtime validators, not standalone YAML.

## Context

P1 shipped a hand-written `legacy-openapi.js` (~1k lines) as a temporary shim.
Two problems compounded over P2 → P5:

- Drift. Every new endpoint (Google Sign-In, presign/confirm photo flow) had
  to be added in two places: the zod request schemas in
  `apps/api/src/http/schemas.ts` and the prose JSON spec.
- No types for clients. `packages/api-contract` was an empty placeholder.
  iOS got a hand-written client; web admin (future) and any external
  integrators would have to read the spec by hand.

## Decision

### Spec is generated, never edited

- Add `@asteasolutions/zod-to-openapi` to `apps/api`.
- New `src/openapi/zod.ts` calls `extendZodWithOpenApi(z)` once, exporting
  the patched `z` so any schema can attach OpenAPI metadata via `.openapi()`.
- New `src/openapi/schemas.ts` declares response shapes (`LoginResponse`,
  `Report`, `MeResponse`, …) as zod objects with `.openapi('Name')` IDs.
- New `src/openapi/registry.ts` is the single registration point: it pulls
  in every request schema from `http/schemas.ts`, every response schema
  from `openapi/schemas.ts`, and registers one `RouteConfig` per HTTP
  endpoint (matching the actual express routes). It then calls
  `OpenApiGeneratorV3.generateDocument({ … })` and caches the result.
- `src/openapi/index.ts` re-exports `openApiSpec` (cached generated doc) +
  `renderSwaggerUi(specUrl)`. Same names as the P1 shim, so `app.ts` is
  untouched.
- `src/legacy-openapi.js` deleted. The `node -e "fs.copyFileSync(...)"` hack
  in `npm run build` is gone.

### Documented surface

The spec covers every route currently mounted under `/api/v1`:

- System: `GET /`, `GET /me`
- Users: `register`, `provision`, `login`, `google`, `refresh`, `logout`,
  `GET /`, `GET /:userId`
- Master: `login`, `refresh`, `logout`, `create`
- Cleaners: `GET /`, `POST /`, `PATCH /:id/supervisor`, `POST /:id/assign`
- Supervisors: `GET /:id/cleaners`
- Reports: `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `GET /user/:userId`,
  `POST /:id/photos/presign`, `POST /:id/photos/confirm`,
  `POST /:id/photos` (deprecated — kept in spec for legacy clients)

A vitest smoke test (`tests/smoke.test.ts`) hits `/api/v1/openapi.json` and
asserts representative paths + components are present, so generation
failures surface in CI.

### Typed SDK in `packages/api-contract`

- New `@spotfix-community/api-contract` package with no runtime dependencies. The
  schemas are restated as plain TypeScript interfaces (mirroring the
  generated OpenAPI shapes) so consumers don't pull in zod or the API code.
- `SpotFixClient` is a small `fetch`-based client:
  - One method per endpoint (`login`, `googleSignIn`, `listReports`,
    `presignReportPhoto`, `confirmReportPhoto`, …).
  - Auto-injects `Authorization: Bearer …` and `X-Tenant-Slug` headers.
  - High-level `uploadReportPhoto(reportId, kind, body, contentType)` runs
    presign → bucket PUT → confirm in one call.
  - `SpotFixApiError` exposes `status`, `code`, `requestId`, `details`,
    matching the API's error envelope.
- Designed for Node 24+ (global `fetch`); accepts a custom `fetch` in
  `SpotFixClientOptions` for tests or older runtimes.

### Why not codegen the SDK from the spec?

- The endpoint surface is small (~25 routes). A 400-line hand-written client
  is more readable, has zero deps, and can ship `BodyInit` overloads that
  generic codegen can't.
- The OpenAPI document is still authoritative for non-TS consumers (Postman,
  external integrators, future Swift / Kotlin codegen). Generation tooling
  can be added later without breaking the SDK.

## Consequences

- Docs and validators can no longer drift: a request schema change is one
  edit and shows up in `/openapi.json` immediately.
- New endpoints require both an express route and a `route({ … })` block in
  `registry.ts`. The smoke test only verifies a fixture set, so reviewers
  must keep `registry.ts` in step with `routes/`.
- The SDK still requires a hand sync when a response schema field is added,
  renamed, or made required. This is documented in the package README and
  is a small price vs. a full codegen pipeline at this stage.
- Wire format is unchanged. iOS keeps its hand-written client; the new SDK
  is purely additive (web admin in P8+ will consume it).

## Follow-ups

- P7: Android (Kotlin + Compose) — could either hand-write a parallel client
  or pipe `/openapi.json` through `openapi-generator` (retrofit2-kotlin).
- Post-P7: explore `swift-openapi-generator` to retire the hand-written iOS
  client.
