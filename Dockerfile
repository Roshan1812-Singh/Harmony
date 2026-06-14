# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Harmony API (NestJS) — production image for the monorepo.
# Build context MUST be the repository root.
#   docker build -t harmony-api .
# Used by Railway / Render / Fly.io etc. Exposes the API on $PORT (default 4000).
# ---------------------------------------------------------------------------

FROM node:22-bookworm-slim AS build
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

# Copy every workspace manifest first so the lockfile resolves (layer-cached).
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

# Copy sources (node_modules/.next/android excluded via .dockerignore) and build.
COPY . .
RUN pnpm --filter @harmony/shared build \
  && pnpm --filter @harmony/api exec prisma generate \
  && pnpm --filter @harmony/api build

# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runner
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production

# Copy the fully-installed, compiled workspace.
COPY --from=build /app /app

WORKDIR /app/apps/api
EXPOSE 4000
# Apply schema + custom SQL on boot, then launch.
CMD ["sh", "scripts/deploy-start.sh"]
