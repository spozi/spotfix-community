# 0011 — Android client built with Jetpack Compose mirroring iOS

Status: Accepted (P7)
Date: 2025-10-11

## Context

P0–P6 delivered the API, web admin (legacy), and the iOS client. The Android client is the second
mobile target. We need parity with iOS for screens and behaviour, but we want to keep the Android
codebase idiomatic, small, and CI-buildable on a vanilla Ubuntu runner.

Constraints:
- The team owning this app is Kotlin-fluent but not Android-native specialised — keep the surface
  small and the dependency graph readable.
- iOS already defined the design system (colours, spacing, role accent). Mirror it directly so the
  two clients evolve together.
- The host that scaffolded the project does not have Android tooling installed; we cannot generate
  a binary `gradle-wrapper.jar` at scaffold time.

## Decision

1. **Jetpack Compose + Material 3** for the entire UI. Compose Compiler plugin (Kotlin 2.0 era).
   minSdk 26 / target & compile 35.
2. **No Hilt / no DI framework.** Singletons (API client, session store, monitor, GoogleSignInProvider)
   live on a custom `SpotFixApplication` and are passed into ViewModels by hand. Keeps the build
   light and the wiring greppable; matches the iOS approach (`AppViewModel` constructed once).
3. **OkHttp + kotlinx.serialization** for the API layer. Retrofit was rejected — surface is small
   (≈12 endpoints), and a hand-rolled `SpotFixApiClient` keeps presigned-photo PUTs (which must
   strip auth headers) explicit.
4. **EncryptedSharedPreferences** (`androidx.security:security-crypto`) as the Keychain
   equivalent. Same JSON wire format as iOS so the blob is reviewable cross-platform.
5. **Manifest meta-data + Gradle properties** for runtime configuration (`SPOTFIX_API_BASE_URL`,
   `SPOTFIX_TENANT_SLUG`, `SPOTFIX_GOOGLE_CLIENT_ID`). Mirrors the iOS Info.plist pattern.
6. **`network_security_config.xml`** restricts cleartext traffic to `10.0.2.2 / localhost / 127.0.0.1`
   so production builds cannot accidentally talk to plain HTTP.
7. **Google Sign-In is a stub** (`LiveGoogleSignInProvider.isConfigured = false`). Wiring the
   Credential Manager + `googleid` SDK is deferred to a follow-up phase. Until enabled the UI
   hides the Google button.
8. **No binary `gradle-wrapper.jar` is committed.** The `gradle/wrapper/gradle-wrapper.properties`
   file pins Gradle 8.10.2; CI uses `gradle/actions/setup-gradle@v3` to provision Gradle and runs
   `gradle wrapper` once before `gradle assembleDebug`. Local developers do the same.

## Consequences

- Adding a new screen costs one `@Composable` + (optionally) one `ViewModel`. No annotation
  processors, no codegen.
- Hand-rolled API client means each new endpoint is ~10 lines but errors must be wrapped
  consistently (`SpotFixApiException`).
- First-time contributors must run `gradle wrapper --gradle-version 8.10.2 --distribution-type bin`
  before `./gradlew` exists. README documents this.
- Cleartext-traffic policy means switching to a self-signed dev backend requires a
  `network_security_config` edit (acceptable; surfaced via build failure).
- Google Sign-In rollout is decoupled from P7; flipping it on is a localized change in
  `LiveGoogleSignInProvider`.
