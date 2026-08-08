# Roadmap

This roadmap keeps the community edition understandable and safe to change. It
describes direction, not a promise of delivery dates.

## Release foundation

- Keep institution-specific configuration, real operational data, credentials
  and private deployment automation outside the public repository.
- Maintain reproducible lockfiles, local Docker startup and CI checks for API,
  web, Android and the shared contract.
- Add a release checklist covering license headers, dependency advisories,
  migrations, API compatibility and secret scanning.

## Architecture cleanup

- Treat `/api/v1` as the stable surface and isolate experimental `/api/v2`
  work. Publish a migration guide before promoting or removing endpoints.
- Split large API route and service modules by use case while preserving tenant
  scoping at repository boundaries.
- Replace duplicated request and response shapes with the shared API contract.
- Move environment-specific behavior behind explicit adapters for identity,
  messaging, storage and maps.

## Quality and maintainability

- Add integration tests against disposable PostgreSQL and S3-compatible
  services for tenancy, uploads and authorization.
- Add component tests for the highest-value web workflows and UI tests for the
  Android reporting and assignment flows.
- Introduce formatter and lint rules gradually so cleanup changes remain small
  and reviewable.
- Document module ownership and record consequential architecture decisions in
  `docs/adr`.

## Community readiness

- Label beginner-friendly issues only after they have clear acceptance criteria
  and a test path.
- Publish versioned releases, changelogs and upgrade notes once the first public
  deployment is repeatable.
- Define a governance and maintainer policy as soon as contributors other than
  the original team receive merge access.

## Commercial boundary

The Apache-2.0 community edition remains usable for self-hosting. Commercial
offerings can package operational value around it: managed hosting, deployment,
identity and workflow integrations, data migration, onboarding, training,
support commitments and compliance features. Public interfaces should remain
documented so the commercial layer does not depend on obscurity or lock-in.
