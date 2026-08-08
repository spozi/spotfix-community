# `@spotfix-community/api-contract`

Typed TypeScript models and client helpers for the SpotFix Community v1 HTTP
API. The wire format mirrors the API's Zod-backed OpenAPI document.

```bash
npm ci
npm run typecheck
npm run build
```

Example:

```ts
import { SpotFixClient } from '@spotfix-community/api-contract';

const client = new SpotFixClient({
  baseUrl: 'http://localhost:5001/api/v1',
  tenantSlug: 'example-campus'
});
```
