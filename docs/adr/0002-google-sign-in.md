# 0002 — Google Sign-In via Google Identity Platform

- Status: Accepted (2026-05-01)
- Phase: P4

## Context

Public users currently register with name + ID number + phone + password.
Friction is high and password reuse is common. The product owner asked for
Google Sign-In on mobile.

## Decision

Adopt **Google Identity Platform** ID-token sign-in on iOS and Android. The
client obtains an ID token via the platform Sign in with Google SDK and
exchanges it at `POST /api/v1/auth/google`. Server verifies with
`google-auth-library` and returns the same internal access + refresh JWT pair
used by password login. No federated session is held.

## Constraints

- **Only ID tokens are accepted** — never raw OAuth access tokens.
- Audience must match a configured Google OAuth client ID
  (`GOOGLE_CLIENT_IDS` env, comma-separated for iOS/Android/Web).
- `email_verified` must be `true` for new account creation.
- `sub` claim is stored on `User.googleSubject` and is the canonical link
  identifier; email is informational and may change.
- Google Sign-In can only create or link **PUBLIC** role accounts. Supervisor,
  cleaner, and master accounts must be provisioned through the existing
  authenticated provisioning flow.

## Consequences

- New columns on `User`: `googleSubject`, `email`, `authProvider`.
- iOS adds the GoogleSignIn-iOS SPM dependency; Android adds Credential
  Manager + Sign in with Google.
- A user who previously registered with ID-number + password can link Google
  by signing in while authenticated (post-P4 follow-up).
