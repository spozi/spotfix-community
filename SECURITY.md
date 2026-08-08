# Security policy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability or exposed credential.
Until a dedicated security mailbox is published, contact the repository owner
privately through the account that hosts this repository.

Include the affected version, reproduction steps, likely impact and any safe
mitigation you have identified. Do not access data that is not yours, disrupt a
live deployment or publish exploit details before a fix is available.

## Supported versions

Before the first stable release, only the latest commit on `main` receives
security fixes. A version support table will be published with v1.0.

Deployers are responsible for replacing all example passwords, configuring
TLS, restricting CORS, rotating secrets, applying database migrations and
keeping dependencies current.
