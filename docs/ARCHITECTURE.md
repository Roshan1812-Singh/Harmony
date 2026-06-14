# Harmony — Architecture

## 1. Goals & non-goals

**Goals**

- Stream legally distributable music with sub-second start time.
- Scale horizontally to millions of plays/day on commodity hardware.
- Type-safety end-to-end (DB → API → UI) via Prisma + Zod-derived TS types.
- Modular boundaries so individual concerns (transcoding, search, auth) can scale or be extracted into separate services later.
- Production hygiene from day one: migrations, tests, observability, secure defaults.

**Non-goals (v1)**

- Native mobile apps (the PWA covers mobile responsively).
- DRM (we only host content licensed for unrestricted streaming).
- Live audio / podcasts (architected for, but not implemented).

## 2. Clean architecture layers

The API follows a **module-per-bounded-context** layout. Each module has the same internal shape:

```
modules/<context>/
├── <context>.module.ts          DI wiring
├── <context>.controller.ts      HTTP layer (DTO validation, OpenAPI, RBAC)
├── <context>.service.ts         Use cases / business logic
├── <context>.repository.ts      Persistence (Prisma) — only place that knows the DB
├── dto/                         Inbound DTOs (class-validator + Swagger)
├── entities/                    Domain entities (separate from Prisma models)
├── events/                      Domain events (EventEmitter2)
└── <context>.spec.ts            Unit tests
```

Dependency direction:

```
controller → service → repository → prisma
                  ↘ (other services via DI, never via http)
```

Cross-cutting concerns (auth, logging, metrics, rate limiting, idempotency) live in `src/common` and apply globally via Nest pipes/guards/interceptors.

## 3. Module map

| Module           | Responsibilities                                                              |
| ---------------- | ----------------------------------------------------------------------------- |
| `auth`           | Register, login, JWT issuance, refresh rotation, OAuth, email verify, reset   |
| `users`          | User profile CRUD, follow/unfollow, settings                                   |
| `artists`        | Artist profile, verification, claim flow                                      |
| `tracks`         | Track CRUD, metadata, licensing tags, moderation status                       |
| `albums`         | Album CRUD, track ordering                                                    |
| `genres`         | Genre taxonomy (seeded)                                                       |
| `uploads`        | Pre-signed S3 PUTs, virus scan hook, metadata extraction, FFmpeg job dispatch |
| `transcoding`    | BullMQ worker — pulls source, produces MP3 128/256 + HLS, writes to S3        |
| `streaming`      | Range requests, signed CloudFront URLs, playback session tracking             |
| `playlists`      | User playlists, collaborative, ordering, sharing                              |
| `likes`          | Liked tracks (favorites)                                                      |
| `library`        | Recently-played, queue persistence                                            |
| `search`         | ES indexing on track/album/artist mutations + query API                       |
| `recommendation` | "More like this", "Made for you" (collaborative filtering v1)                 |
| `analytics`      | Play counts, listener counts, top-tracks, materialized rollups                |
| `admin`          | User/track/artist moderation, takedown, platform stats                        |
| `notifications`  | Email (SES / Resend) for verify, reset, follower alerts                       |
| `health`         | `/healthz`, `/readyz`, Prometheus `/metrics`                                  |

## 4. Data flow examples

### 4.1 Upload → playable

```
[Artist] ─POST /uploads/sign──▶ [API]
                                 │ verifies artist role, generates S3 pre-signed PUT
[Artist] ─PUT (audio) ─────────▶ [S3 raw/]
[Artist] ─POST /tracks ────────▶ [API] (stores metadata, status=PROCESSING)
                                 │ enqueues "transcode" job in BullMQ
                                 ▼
                          [Transcode worker]
                          ├─ downloads from s3://raw/
                          ├─ ffmpeg → mp3-128k, mp3-256k, HLS (.m3u8 + segments)
                          ├─ uploads to s3://stream/
                          ├─ writes loudness/duration/peak/waveform JSON
                          ├─ indexes track in Elasticsearch
                          └─ sets status=READY, emits track.ready event
```

### 4.2 Playback

```
[Player] ──GET /stream/:trackId/manifest─▶ [API]
                                            │ checks visibility, increments play (debounced 30s),
                                            │ returns signed CloudFront URL (TTL 60min)
[Player] ──GET CloudFront/.../track.m3u8──▶ [Edge cached]
[Player] ──GET ...segment.ts (Range)──────▶ [CloudFront → S3]
[Player] ──POST /stream/heartbeat────────▶ [API] (every 30s; writes to recently_played)
```

### 4.3 Search

- Writes to `tracks`/`albums`/`artists` emit domain events.
- `SearchIndexerService` listens, upserts ES documents asynchronously.
- Read path queries ES first; falls back to Postgres `tsvector @@ websearch_to_tsquery` if ES is unhealthy.

## 5. Caching strategy

| Layer | Cache | TTL | Invalidation |
| --- | --- | --- | --- |
| Edge | CloudFront (audio segments, artwork) | 7d | Versioned URLs |
| Edge | Next.js `revalidate` (RSC fetch) | 60s | Tag-based `revalidateTag` |
| API  | Redis (track meta, artist meta, top charts) | 5–60min | Write-through on mutate |
| API  | Redis (recently-played list per user) | infinite (capped 100) | LPUSH/LTRIM |
| API  | Redis (rate-limit counters) | sliding window | TTL |
| API  | Redis (refresh-token JTI → user) | 30d | Logout / rotation |
| DB   | Postgres `pg_stat_statements` + tuned shared_buffers | — | — |

## 6. Security model

See [SECURITY.md](./SECURITY.md). Highlights:

- JWT (access, 15min, RS256, public key on API), refresh tokens (opaque, 30d, in Redis, rotated on every use).
- Tokens delivered as `httpOnly; Secure; SameSite=Lax` cookies.
- CSRF: double-submit cookie pattern for state-changing endpoints (the cookie is `SameSite=Lax`, but we still require an `x-csrf-token` header matching a non-httpOnly readable cookie for defense-in-depth).
- All inputs validated with `class-validator` + DTOs; SQL only via Prisma (no string concat).
- File uploads: MIME sniff (magic bytes), size cap, extension/MIME match, queued AV scan (ClamAV) before publish.
- Rate limiting: Redis-backed sliding window per IP + per user.
- Helmet + strict CSP on web.
- Logs scrub PII (`pino-redact`).

## 7. Scalability considerations

- **API**: Stateless containers behind ALB. Horizontal autoscale on CPU + p95 latency. Sticky sessions not required.
- **DB**: RDS Postgres with a read replica for analytics queries. `pgbouncer` for connection pooling in front.
- **Redis**: ElastiCache cluster mode for >100k connections. Sentinel for HA in self-hosted.
- **Search**: ES managed cluster (3 master, n data). Indexing decoupled via queue so write traffic doesn't stall on ES.
- **Audio**: S3 is effectively infinite; CloudFront absorbs read traffic. Transcoding workers scale on queue depth.
- **Cost**: Most reads hit CDN/cache, only writes + cold paths touch RDS. Single c6g.large API node handles ~5k RPS of cached reads in load tests.

## 8. Why a monorepo

- Shared `packages/shared` exports Zod schemas used by both client (form validation) and server (DTO validation), so a field rename breaks compilation in both places at once.
- Single PR can land DB migration + API change + UI change atomically.
- Turbo's remote cache makes CI fast even as the repo grows.

## 9. Design decisions worth calling out

1. **NestJS over plain Express** — Decorators, DI, and Swagger autogeneration save weeks of boilerplate; the perf overhead is negligible behind a CDN.
2. **Prisma over TypeORM** — Better migration story, type inference is stronger, the codegen surfaces breaking schema changes immediately.
3. **JWT (RS256) + opaque refresh** — Best of both worlds: stateless reads (any node verifies with public key), revocable refresh (Redis is the source of truth).
4. **Elasticsearch optional** — Postgres FTS handles low traffic; ES unlocks fuzzy matching and ranking at scale. Indexer is async so ES outage doesn't break writes.
5. **HLS + MP3 fallback** — Modern browsers do HLS via `hls.js`; we keep an MP3 fallback for Safari iOS and old clients. Saves bandwidth on slow connections (HLS auto-bitrate).
6. **BullMQ over SQS** — Same Redis cluster; saves an AWS service; portable to any cloud.
7. **`status` enum on `Track`** — `DRAFT → PROCESSING → READY → REJECTED → TAKEDOWN`. Makes moderation states explicit and queryable.
8. **Soft delete via `deletedAt`** — Required for moderation/legal review windows.

## 10. Future work (intentionally deferred)

- WebSocket for real-time "now playing" social feed.
- ML-driven recommendations (matrix factorization served via a sidecar).
- Mobile native (React Native sharing 80% of UI components).
- Lyrics sync (LRC) + karaoke mode.
- Payments / artist payouts (Stripe Connect).
