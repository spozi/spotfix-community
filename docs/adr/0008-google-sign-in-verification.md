# ADR 0008 — Google Sign-In via verified ID tokens

Status: Accepted (P4)
Supersedes: extends ADR 0002 (Google Sign-In as the only social provider)

## Context

Pre-modernization, the legacy server treated Google Sign-In as a client-side
concern: the iOS app received a Google ID token from the GoogleSignIn SDK and
posted it to the API, which trusted the token without cryptographic
verification. A token issued for any other application could be replayed
against SpotFix Community and impersonate a user.

P4 of the modernization closes this hole and standardizes the server contract
so iOS, Android, and the eventual Web client all use the same surface.

## Decision

- The server verifies every Google ID token cryptographically using
  [`google-auth-library`](https://github.com/googleapis/google-auth-library-nodejs)
  (`OAuth2Client.verifyIdToken`). The library handles signature verification,
  issuer pinning, expiry, and Google's public-key cache.
- Audience is pinned to the comma-separated `GOOGLE_CLIENT_IDS` env var
  (parsed in `apps/api/src/config/env.ts` → `googleClientIds`). Each first-
  party client (iOS, Android, Web) registers its own OAuth client ID; all of
  them go in this list. Tokens minted for any other client are rejected.
- Issuer must be `accounts.google.com` or `https://accounts.google.com`.
- Email must be present and `email_verified !== false`.
- One server endpoint: `POST /api/v1/users/google { idToken }`. Tenant is
  resolved by the same middleware as `/login` (`X-Tenant-Slug` header for
  unauthenticated requests). Response shape mirrors `/login` so existing
  client envelope-handling code is reused.

## Account resolution (within active tenant scope)

1. Match by stable Google subject id (`googleSub`).
2. Else match by verified email; if a row exists with no `googleSub`, link
   it (first-time sign-in for an existing password user). If the row already
   has a different `googleSub`, return 409 Conflict.
3. Else create a new `UserAccount` (role `public`) with no password hash.
   `idNumber` is synthesized as `g:<sub>` so the legacy iOS surface still has
   a unique value; UI updates can swap to email or `name` later.

## Schema changes

`UserAccount` columns added:

- `passwordHash` made nullable (Google-only users have no local password).
- `googleSub String?` — unique within tenant.
- `email String?` — unique within tenant.

Two new composite uniques: `@@unique([tenantId, googleSub])`,
`@@unique([tenantId, email])`. Existing `@@unique([tenantId, idNumber])`
preserved.

## Security notes

- Tokens are validated on every call — no JIT caching of the verification
  result. Google's JWKS is cached inside `OAuth2Client` already.
- The endpoint goes through the same `authRateLimiter` as password login.
- If `GOOGLE_CLIENT_IDS` is empty the endpoint returns
  `INVALID_TOKEN: Google Sign-In is not configured on this server`. Production
  deployments must populate it; the API never accepts arbitrary audiences.
- iOS / Android clients keep using the official Google SDK to obtain the ID
  token; the server never sees the user's Google credentials.

## Consequences

- The legacy "trust the token" path is gone. Any client that was previously
  posting a token to `/api/google-login` (legacy Express server) must move to
  `/api/v1/users/google`.
- Existing password-login users can transparently link a Google account on
  first sign-in (matched by verified email). No data migration needed.
- Master users (`MasterUser`) intentionally do not get Google Sign-In —
  internal admin accounts stay on username + password (ADR 0004 boundary).

## Follow-ups

- P5: iOS Keychain + GoogleSignIn SDK integration; client posts ID token and
  stores returned access/refresh tokens in Keychain.
- P7: Android Kotlin client uses Credential Manager + the same endpoint.
