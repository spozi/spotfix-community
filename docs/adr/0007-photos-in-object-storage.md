# 0007 — Photos in S3-compatible object storage (MinIO + OCI Object Storage)

Date: 2026-05-01
Status: Accepted

## Context

Through P2 the API persisted photos (`evidencePhoto`, `photos[]`,
`resolutionPhoto`) as base64 data URLs inside Postgres rows. That worked for a
demo but is wrong long-term:

- Row size grows with every photo, breaking JSON body limits, query times,
  caching, and replication.
- Backup/restore of Postgres carries blob weight unrelated to relational data.
- We cannot stream binary efficiently to mobile clients.

## Decision

- All photos live in an S3-compatible bucket, addressed by **object keys**:
  `tenants/<tenantId>/reports/<reportPublicId>/<kind>/<uuid>.<ext>`.
  Tenant prefix is mandatory and is built from the active tenant context
  (ADR 0006). Cross-tenant access is impossible by construction.
- Local dev + CI use **MinIO** (`docker-compose` ships a MinIO container plus
  a `minio-init` sidecar that creates the bucket idempotently).
  Production targets **OCI Object Storage** via its S3-compatible endpoint;
  the same SDK and code path applies.
- The single SDK is `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`.
- Postgres `Report.evidencePhoto`, `resolutionPhoto`, and `photos` columns
  store **object keys**, not binary or base64. Outbound serialization
  ([`reports.service.ts`](../../apps/api/src/domain/reports/reports.service.ts))
  resolves keys to short-lived presigned `GET` URLs (default TTL 15 minutes,
  env-tunable). Legacy data URLs / absolute URLs are passed through unchanged.
- Two upload paths are supported:
  1. **Direct upload** (preferred): client calls
     `POST /reports/:id/photos/presign` with `{ kind, contentType, contentLength }`,
     receives `{ key, uploadUrl, headers, expiresIn }`, PUTs the binary
     directly to MinIO/S3, then `POST /reports/:id/photos/confirm` with the
     returned key. The API never touches the bytes.
  2. **Legacy base64**: pre-P3 iOS clients still POST data URLs in
     `evidencePhoto` / `photos[]` / `resolutionPhoto`. The
     [`photosService`](../../apps/api/src/domain/photos/photos.service.ts)
     decodes, uploads to S3, and stores the resulting key. Removed in P5
     when the iOS client is rewritten.
- Allowed content types: `image/jpeg`, `image/png`, `image/webp`,
  `image/heic`, `image/heif`. Hard cap on per-photo size via
  `STORAGE_MAX_UPLOAD_BYTES` (default 10 MiB).
- Express JSON body limit dropped from 50 MiB to 15 MiB now that the heavy
  payloads have moved off the JSON path.

## Consequences

- Postgres stays small and queryable; backups carry only relational data.
- Mobile clients can upload and download binaries directly to/from object
  storage, paying only for credentials issuance through the API.
- Photos are tenant-scoped at the storage layer too — even a stolen presigned
  URL only exposes one object for a few minutes.
- The iOS client (today) still parses `evidencePhoto` strings as data URLs
  via `Data(base64Encoded:)`. Once a deployment serves presigned `https://`
  URLs, the existing iOS render code returns nil. P5 (iOS refresh) will swap
  in `URLSession`/`AsyncImage` rendering. Until then, the API still accepts
  base64 uploads, but rendered images on the existing app will be blank for
  any photo uploaded through the new path. This is an accepted, time-boxed
  regression because there are no production users yet.
- Cross-cloud portability is preserved: S3 / OCI / MinIO are interchangeable
  via `STORAGE_*` env vars; no Azure/AWS lock-in.
