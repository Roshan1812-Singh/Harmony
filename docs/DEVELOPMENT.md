# Harmony — Development

## Prerequisites

- Node 20.x or 22.x
- pnpm 9.x (`corepack enable && corepack prepare pnpm@latest --activate`)
- Docker Desktop / OrbStack
- ffmpeg (`brew install ffmpeg` / `apt install ffmpeg` / `choco install ffmpeg`)

## First run

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

docker compose up -d                          # postgres, redis, elasticsearch, minio, mailhog
pnpm --filter @harmony/api db:migrate
pnpm --filter @harmony/api db:seed
pnpm dev                                      # turbo runs web + api
```

## Default seeded accounts

| Email | Password | Role |
|---|---|---|
| admin@harmony.local | Admin!234 | ADMIN |
| artist@harmony.local | Artist!2345 | ARTIST |
| demo@harmony.local | Demo!2345 | USER |

## Scripts

| Command | What |
|---|---|
| `pnpm dev` | turbo: web (3000) + api (4000) |
| `pnpm build` | build all packages |
| `pnpm lint` | eslint across workspaces |
| `pnpm test` | vitest + jest |
| `pnpm test:e2e` | Playwright (web) + supertest (api) |
| `pnpm --filter @harmony/api db:migrate` | Prisma migrate dev |
| `pnpm --filter @harmony/api db:reset` | DROP + migrate + seed |

## Project layout

See [README.md](../README.md) and [ARCHITECTURE.md](./ARCHITECTURE.md).
