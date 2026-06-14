# Harmony — Database Reference

PostgreSQL 16. Managed with Prisma. All identifiers are UUID v7 (time-sortable).

## ER diagram (textual)

```
                     ┌────────────────┐
                     │     User       │◀───┐
                     │ id (uuid)      │    │ following
                     │ email          │    │ (m:n via Follow)
                     │ passwordHash   │    │
                     │ role           │    │
                     │ ...            │────┘
                     └─┬────────┬─────┘
            owns       │        │ has 0..1
                       ▼        ▼
                ┌─────────┐  ┌─────────────┐
                │Playlist │  │  Artist     │
                │ id      │  │ id          │
                │ userId  │  │ userId(FK)  │
                │ name    │  │ displayName │
                │ public  │  │ verified    │
                └──┬──────┘  └──┬──────────┘
       PlaylistTrack│            │ owns
       (ordered)   ▼             ▼
              ┌─────────┐    ┌───────────┐
              │  Track  │───▶│  Album    │
              │ id      │    │ id        │
              │ albumId │    │ artistId  │
              │ artistId│    │ releaseDt │
              │ status  │    │ cover     │
              │ ...     │    └───────────┘
              └──┬──────┘
                 │ m:n via TrackGenre
                 ▼
              ┌─────────┐
              │ Genre   │
              │ slug    │
              └─────────┘

User ──Like──▶ Track
User ──Follow──▶ Artist
User ──RecentlyPlayed──▶ Track    (timestamped)
User ──PlaybackSession──▶ Track   (sampled, for analytics)
```

## Table-by-table

### `User`
| Column          | Type        | Notes                                        |
|-----------------|-------------|----------------------------------------------|
| id              | uuid PK     | v7                                           |
| email           | text UNIQUE | citext via Prisma `@db.Citext`               |
| passwordHash    | text NULL   | NULL for OAuth-only users                    |
| displayName     | text        |                                              |
| avatarUrl       | text NULL   |                                              |
| role            | enum        | `USER` \| `ARTIST` \| `ADMIN`                |
| emailVerifiedAt | timestamptz NULL |                                         |
| oauthProviders  | jsonb       | `{ google?: sub, github?: sub }`             |
| createdAt       | timestamptz |                                              |
| updatedAt       | timestamptz |                                              |
| deletedAt       | timestamptz NULL | soft delete                             |

Indexes: `(email)`, `(role)`, `(deletedAt) WHERE deletedAt IS NULL`.

### `Artist`
1:1 with User when `role='ARTIST'`. Public-facing profile.

| Column        | Type | Notes |
|---------------|------|-------|
| id            | uuid PK |    |
| userId        | uuid FK UNIQUE | |
| displayName   | text |    |
| slug          | text UNIQUE | url-safe |
| bio           | text |    |
| coverUrl      | text NULL | |
| verified      | bool default false | |
| monthlyListeners | int default 0 | denormalised, refreshed nightly |
| searchVector  | tsvector | generated, GIN-indexed |

### `Album`
| Column      | Type | Notes |
|-------------|------|-------|
| id          | uuid PK | |
| artistId    | uuid FK | |
| title       | text | |
| slug        | text | |
| coverUrl    | text NULL | |
| releaseDate | date | |
| license     | enum | `CC0` `CC_BY` `CC_BY_SA` `CC_BY_NC` `PUBLIC_DOMAIN` `ROYALTY_FREE` `ARTIST_OWNED` |
| createdAt   | timestamptz | |
| searchVector | tsvector | |

Unique: `(artistId, slug)`.

### `Track`
| Column        | Type | Notes |
|---------------|------|-------|
| id            | uuid PK | |
| albumId       | uuid FK NULL | singles allowed |
| artistId      | uuid FK | denormalised for fast filtering |
| title         | text | |
| slug          | text | |
| trackNumber   | int NULL | |
| durationMs    | int | populated by transcoder |
| explicit      | bool default false | |
| license       | enum | same as Album |
| status        | enum | `DRAFT` `PROCESSING` `READY` `REJECTED` `TAKEDOWN` |
| sourceKey     | text | s3 key of original upload |
| streamKey     | text NULL | s3 key prefix of transcoded outputs (`stream/<id>/`) |
| waveformJson  | jsonb NULL | precomputed peaks for UI scrubber |
| playCount     | bigint default 0 | denormalised, eventually consistent |
| createdAt     | timestamptz | |
| updatedAt     | timestamptz | |
| deletedAt     | timestamptz NULL | |
| searchVector  | tsvector | |

Indexes: `(artistId)`, `(albumId)`, `(status)`, `(createdAt DESC)`, GIN `searchVector`.

### `Genre`
Static-ish taxonomy: `id`, `name`, `slug UNIQUE`. Seeded.

### `TrackGenre`
Join table. `(trackId, genreId)` composite PK.

### `Playlist`
| Column     | Type | Notes |
|------------|------|-------|
| id         | uuid PK | |
| userId     | uuid FK | owner |
| name       | text | |
| description| text NULL | |
| coverUrl   | text NULL | |
| isPublic   | bool default true | |
| isCollaborative | bool default false | |
| createdAt  | timestamptz | |
| updatedAt  | timestamptz | |

### `PlaylistTrack`
`(playlistId, position)` composite PK; `trackId` FK; `addedById`, `addedAt`.

### `Like`
`(userId, trackId)` composite PK; `createdAt`.

### `Follow`
`(followerId, artistId)` composite PK; `createdAt`.

### `RecentlyPlayed`
| Column   | Type | Notes |
|----------|------|-------|
| id       | bigserial PK | |
| userId   | uuid FK | |
| trackId  | uuid FK | |
| playedAt | timestamptz | |

Partial index `(userId, playedAt DESC)`. Trimmed to last 100 per user nightly.

### `PlaybackSession`
Sampled session for analytics (NOT every play). One row per uninterrupted listen.

| Column      | Type | Notes |
|-------------|------|-------|
| id          | uuid PK | |
| userId      | uuid FK NULL | NULL for anonymous |
| trackId     | uuid FK | |
| startedAt   | timestamptz | |
| endedAt     | timestamptz NULL | |
| msPlayed    | int default 0 | |
| client      | text | `web`, `pwa` |
| ipHash      | text | sha256(ip + daily salt) — privacy |

### `AuditLog` (admin)
Append-only; (actorId, action, targetType, targetId, payload jsonb, createdAt).

### `RefreshToken` (in Redis, not Postgres)
Key: `rt:{jti}` → JSON `{ userId, family, createdAt }`. TTL = 30d. Rotation increments family; reuse of an old jti in a family revokes the whole family (detect token theft).

## Migrations

```bash
pnpm --filter @harmony/api prisma migrate dev --name <description>
pnpm --filter @harmony/api prisma migrate deploy   # production
```

Migration files committed under `apps/api/prisma/migrations/`. Never edit applied migrations — add new ones.

## Seed data

`apps/api/prisma/seed.ts` seeds:

- 1 admin (`admin@harmony.local` / `Admin!234`)
- 1 demo user (`demo@harmony.local` / `Demo!2345`)
- 1 verified artist (`artist@harmony.local` / `Artist!2345`) with 1 album of 3 CC0 tracks
- 12 genres
- A handful of demo playlists

## Indexing strategy summary

- All FKs are indexed (Prisma does this automatically).
- All `searchVector` columns have GIN indexes.
- Hot sort paths (`createdAt DESC`, `playedAt DESC`) get b-tree indexes.
- Soft-delete filters use partial indexes (`WHERE deletedAt IS NULL`).
- Composite indexes on `(userId, playedAt DESC)`, `(artistId, releaseDate DESC)`.
- `pg_stat_statements` enabled in prod for slow-query review.
