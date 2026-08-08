# Contributing

Thank you for helping improve SpotFix Community.

## Before starting

Sign the [Contributor License Agreement](CLA.md) before your first contribution
is merged. You sign once and it covers your later pull requests. You keep
ownership of your work; the agreement lets the maintainers keep the project's
licensing durable over time. See `CLA.md` for what it grants and why.

For a substantial feature or schema change, open an issue describing the user
problem and proposed boundary before writing code. Small fixes can go directly
to a pull request.

Do not submit real tenant data, credentials, private infrastructure details or
assets you do not have permission to redistribute. Run `npm run check:public`
before every commit.

## Development workflow

1. Create a focused branch from `main`.
2. Install dependencies with `npm ci` in the application you change.
3. Add or update tests for behavioral changes.
4. Run `npm run check` and the relevant mobile build.
5. Sign off your commits with `git commit -s` (Developer Certificate of Origin).
6. Explain user-visible behavior, migration impact and test evidence in the PR.

API wire-format changes must update schemas, OpenAPI output, contract tests and
affected clients together. Database migrations must be additive and safe for an
existing deployment.

## Pull-request expectations

- Keep changes focused and reviewable.
- Preserve tenant isolation and authorization checks.
- Never weaken validation or security merely to make a test pass.
- Include screenshots for visible UI changes.
- Disclose material AI assistance in the PR description and verify every
  generated change yourself. Maintainers evaluate the code, not how it was
  produced.

## Licensing

The community edition is distributed under the Apache License, Version 2.0, and
your contributions are released under that license.

Contributions are also covered by the [Contributor License Agreement](CLA.md),
which grants the maintainers the right to license contributed code under
additional terms. This does not affect your ownership of your own work, and it
does not change the Apache-2.0 license of this repository.
