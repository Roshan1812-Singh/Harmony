-- Full-text search: generated `search_vector` tsvector columns + GIN indexes.
-- Prisma can't declare generated tsvector columns, so they're patched in here.
-- Idempotent (safe to re-run). Was formerly prisma/migrations/..._fts.

-- Artists -------------------------------------------------------------------
ALTER TABLE "artists"
  ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("displayName", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("bio", '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS "artists_search_vector_idx" ON "artists" USING GIN ("search_vector");
CREATE INDEX IF NOT EXISTS "artists_displayName_trgm_idx" ON "artists" USING GIN ("displayName" gin_trgm_ops);

-- Albums --------------------------------------------------------------------
ALTER TABLE "albums"
  ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("title", '')), 'A')
  ) STORED;

CREATE INDEX IF NOT EXISTS "albums_search_vector_idx" ON "albums" USING GIN ("search_vector");
CREATE INDEX IF NOT EXISTS "albums_title_trgm_idx" ON "albums" USING GIN ("title" gin_trgm_ops);

-- Tracks --------------------------------------------------------------------
ALTER TABLE "tracks"
  ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("title", '')), 'A')
  ) STORED;

CREATE INDEX IF NOT EXISTS "tracks_search_vector_idx" ON "tracks" USING GIN ("search_vector");
CREATE INDEX IF NOT EXISTS "tracks_title_trgm_idx" ON "tracks" USING GIN ("title" gin_trgm_ops);

-- Partial index used to filter ready tracks fast.
CREATE INDEX IF NOT EXISTS "tracks_ready_recent_idx"
  ON "tracks" ("createdAt" DESC)
  WHERE "status" = 'READY' AND "deletedAt" IS NULL;
