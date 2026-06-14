# Harmony

A production-ready music streaming platform for legally distributable music
(royalty-free, public-domain, Creative Commons, or artist-uploaded content).

> Think Spotify, but only for music you're actually allowed to stream.

## Stack

- **Frontend** — Next.js 15 (App Router) + React 19 + TypeScript + Tailwind v4 + Zustand + TanStack Query
- **Backend**  — NestJS 11 + TypeScript + Prisma 6 + PostgreSQL 16 + Redis 7 + BullMQ + Elasticsearch 8
- **Storage**  — AWS S3 (audio + artwork) + CloudFront (CDN)
- **Auth**     — JWT (RS256) + refresh tokens in Redis + Google/GitHub OAuth + email verification
- **Streaming** — HTTP range requests + signed CloudFront URLs + HLS adaptive bitrate
- **Search**   — Elasticsearch with PostgreSQL FTS fallback
- **Infra**    — Docker, docker-compose, Kubernetes manifests, Nginx, GitHub Actions
- **Observability** — Prometheus + Grafana + Pino (JSON logs) + Sentry

## Repository layout

```
harmony/
├── apps/
│   ├── web/                  Next.js 15 frontend (App Router, RSC)
│   └── api/                  NestJS 11 backend
├── packages/
│   ├── shared/               Shared TS types, Zod schemas, constants
│   └── config/               Shared eslint/tsconfig/prettier presets
├── infra/
│   ├── docker/               Production Dockerfiles
│   ├── compose/              docker-compose files (dev + e2e)
│   ├── nginx/                Edge proxy config (TLS, rate limit, gzip, range)
│   ├── k8s/                  Kubernetes manifests (deployments, services, HPA, ingress)
│   ├── prometheus/           Scrape config + alert rules
│   └── grafana/              Dashboards (JSON)
├── docs/
│   ├── ARCHITECTURE.md       Layers, modules, data flow, design decisions
│   ├── DATABASE.md           ER diagram + table-by-table reference
│   ├── API.md                REST conventions + OpenAPI usage
│   ├── SECURITY.md           Threat model + controls
│   ├── DEPLOYMENT.md         AWS / Vercel / Render / Railway runbooks
│   └── DEVELOPMENT.md        Local dev setup
├── .github/workflows/        CI/CD (lint, test, build, deploy)
├── docker-compose.yml        One-command local dev stack
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

## Quick start

```bash
# Prereqs: Node 20+, pnpm 9+, Docker, ffmpeg (host or container)

pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# Spin up Postgres + Redis + Elasticsearch + MinIO (S3-compatible)
docker compose up -d postgres redis elasticsearch minio

# Migrate + seed
pnpm --filter @harmony/api db:migrate
pnpm --filter @harmony/api db:seed

# Dev
pnpm dev
# → web at http://localhost:3000
# → api at http://localhost:4000/api/v1
# → swagger at http://localhost:4000/docs
```

## Documentation

- [ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [DATABASE.md](./docs/DATABASE.md)
- [API.md](./docs/API.md)
- [SECURITY.md](./docs/SECURITY.md)
- [DEPLOYMENT.md](./docs/DEPLOYMENT.md)
- [DEVELOPMENT.md](./docs/DEVELOPMENT.md)

## License

MIT
