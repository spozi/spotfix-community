# SpotFix Community Android

Native Kotlin and Jetpack Compose client for the supported v1 API.

Requirements: JDK 17, Android SDK API 36 and an `apps/android/local.properties`
file pointing to your SDK.

```bash
./gradlew testDebugUnitTest
./gradlew assembleDebug
```

The debug default is `http://10.0.2.2:5001/api/v1`, which reaches the host from
the Android emulator. Override configuration per build:

```bash
./gradlew assembleDebug \
  -PspotfixApiBaseUrl=https://api.example.com/api/v1 \
  -PspotfixTenantSlug=example-campus \
  -PspotfixGoogleClientId=YOUR_WEB_OAUTH_CLIENT_ID
```

Google Sign-In and Firebase messaging remain disabled when their configuration
values are empty. Release signing must be provided through `SPOTFIX_RELEASE_*`
environment variables or matching Gradle properties; keystores must never be
committed.

## Synthetic-data demo

The `demo` build type runs the production Compose screens against a fictional,
in-memory campus dataset. It does not call the API or require credentials. Pick
Public, Supervisor, Cleaner, or Master Admin on the landing screen to enter that
role immediately.

```bash
./gradlew assembleDemo
adb install -r app/build/outputs/apk/demo/app-demo.apk
```

The walkthrough includes report submission, assignments, evidence upload,
cleaner resolution, supervisor endorsement, notifications, user provisioning,
and the public status board. Changes persist while the app process is alive and
reset to the original synthetic dataset when the process restarts. Debug and
release builds continue to use the configured live API.
