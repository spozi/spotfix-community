# SpotFix Community

SpotFix Community is an open-source facility issue reporting and maintenance
coordination platform. Reporters submit issues with location and photo evidence;
supervisors assign work; field teams update progress; administrators monitor the
operation.

This repository is an early community release. The v1 HTTP API is the supported
client surface. The v2 API under `apps/api/src/v2` is experimental and may change
before a stable release.

## Included applications

- `apps/api` — Express, TypeScript, Prisma, PostgreSQL and S3-compatible storage.
- `apps/web` — React and Vite web portal.
- `apps/android` — Kotlin and Jetpack Compose Android client.
- `packages/api-contract` — typed TypeScript API contract.
- `infra/docker` — local PostgreSQL, MinIO, API and web stack.
- `examples/seed` — fictional bootstrap data safe for demonstrations.

Production credentials, real staff data, institution-specific branding and
private deployment automation are intentionally not part of this repository.

## Requirements

- Node.js 24+
- npm 10+
- Docker with Compose v2 for the full local stack
- JDK 17 and Android SDK API 36 for Android development

## Start the local stack

```bash
docker compose -f infra/docker/docker-compose.dev.yml up --build -d
docker compose -f infra/docker/docker-compose.dev.yml exec api npx prisma migrate deploy
docker compose -f infra/docker/docker-compose.dev.yml run --rm \
  -v "$PWD/examples/seed:/app/examples:ro" \
  -e BOOTSTRAP_TENANT_SLUG=example-campus \
  -e BOOTSTRAP_TENANT_NAME="Example Campus Facilities" \
  -e BOOTSTRAP_MASTER_USERNAME=admin \
  -e BOOTSTRAP_MASTER_PASSWORD=change-this-demo-password \
  -e BOOTSTRAP_MASTER_NAME="Example Administrator" \
  -e BOOTSTRAP_SUPERVISOR_FILE=/app/examples/supervisors.csv \
  -e BOOTSTRAP_CLEANER_FILE=/app/examples/cleaners.csv \
  api npm run bootstrap
```

The API is available at `http://localhost:5001`, its OpenAPI document at
`http://localhost:5001/api/v1/openapi.json`, and the web portal at
`http://localhost:4173`.

The bootstrap command mounts the fictional example data read-only. Replace the
demo password and example records before using the system outside local testing.

Google Sign-In and Firebase messaging are disabled until you provide your own
project configuration. No shared OAuth or Firebase credentials are distributed.

## Develop without Docker

```bash
npm --prefix apps/api ci
npm --prefix apps/web ci
npm --prefix packages/api-contract ci
cp apps/api/.env.example apps/api/.env
npm --prefix apps/api run prisma:generate
npm run api:dev
```

In another terminal:

```bash
npm run web:dev
```

You still need PostgreSQL and S3-compatible object storage. The defaults in
`apps/api/.env.example` match the local Docker services.

## Validate a change

```bash
npm run check
npm run android:test
```

The public-tree check rejects credential file types, old private identifiers,
generated build output and common private-key markers before they enter Git.

## Project status and scope

The current priorities are repository cleanup, clearer API versioning, smaller
feature modules and stronger web/mobile tests. The staged cleanup and
refactoring plan is in `ROADMAP.md`. See `CONTRIBUTING.md` before opening a pull
request. Security reports must follow `SECURITY.md` and must not be filed as
public issues.

## Commercial services

The Apache-2.0 software can be self-hosted without charge. Managed deployments,
implementation, integrations, training and enterprise support may be offered
separately by service providers; no commercial service is required to use the
community edition.

## License

Licensed under the Apache License, Version 2.0. See `LICENSE`.
