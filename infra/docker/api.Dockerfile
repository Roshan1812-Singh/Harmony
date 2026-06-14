# ───────────────────────────────────────────────────────────────
# Stage 1: pnpm fetch + workspace install
# ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN corepack enable && apk add --no-cache python3 make g++ openssl
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @harmony/api... --filter @harmony/shared

# ───────────────────────────────────────────────────────────────
# Stage 2: build TypeScript → dist
# ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
RUN corepack enable && apk add --no-cache openssl
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /repo/packages/shared/node_modules ./packages/shared/node_modules
COPY . .
RUN pnpm --filter @harmony/shared build
RUN pnpm --filter @harmony/api prisma generate
RUN pnpm --filter @harmony/api build

# ───────────────────────────────────────────────────────────────
# Stage 3: runtime — slim image with ffmpeg + production deps
# ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
RUN apk add --no-cache ffmpeg openssl dumb-init
WORKDIR /app

ENV NODE_ENV=production \
    PORT=4000

# Copy only what we need
COPY --from=build /repo/apps/api/dist               ./dist
COPY --from=build /repo/apps/api/prisma             ./prisma
COPY --from=build /repo/apps/api/package.json       ./package.json
COPY --from=build /repo/apps/api/node_modules       ./node_modules
COPY --from=build /repo/packages/shared/dist        ./node_modules/@harmony/shared/dist
COPY --from=build /repo/packages/shared/package.json ./node_modules/@harmony/shared/package.json

USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/readyz | grep -q '"status":"ok"' || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
