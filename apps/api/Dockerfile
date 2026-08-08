# syntax=docker/dockerfile:1.7
# Multi-arch image: built for linux/amd64 + linux/arm64 (Oracle Cloud Ampere A1).
# Do NOT pin --platform here; let buildx pick.

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-bookworm-slim AS base
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

# ---- deps stage: install full deps (includes devDeps for the TS build) ----
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# ---- build stage: compile TypeScript to dist/ ----
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src
RUN npm run build

# ---- prod-deps stage: production-only node_modules ----
FROM base AS prod-deps
WORKDIR /app
COPY package.json package-lock.json* prisma.config.ts ./
COPY prisma ./prisma
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi \
 && npm install --no-save prisma@7.9.1 tsx@4.21.0 \
 && npx prisma generate

# ---- runtime stage ----
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=5001 \
    HOST=0.0.0.0
WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY scripts ./scripts
COPY src ./src
COPY package.json ./

USER node

EXPOSE 5001
CMD ["node", "dist/server.js"]
