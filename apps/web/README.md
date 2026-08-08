# SpotFix Community Web

React and Vite web portal for reporting, public status monitoring and
role-specific maintenance workflows.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

The default API is `http://localhost:5001/api/v1` with tenant slug
`example-campus`. Override both values in `.env.local` for another deployment.

Build the production bundle with `npm run build`. The Docker image writes
runtime configuration to `public/env.js`, allowing one image to be used across
deployments without rebuilding.
