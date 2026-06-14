-- Adds generated `search_vector` columns + GIN indexes to artists, albums, tracks.
-- Prisma can't yet declare generated tsvector columns, so this migration patches them in.

-- Artists ---------------------------------------------------------------
ALTER TABLE "artists"
  ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("displayName", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("bio", '')), 'C')
  ) STORED;

CREATE INDEX "artists_search_vector_idx" ON "artists" USING GIN ("search_vector");
CREATE INDEX "artists_displayName_trgm_idx" ON "artists" USING GIN ("displayName" gin_trgm_ops);

-- Albums ----------------------------------------------------------------
ALTER TABLE "albums"
  ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("title", '')), 'A')
  ) STORED;

CREATE INDEX "albums_search_vector_idx" ON "albums" USING GIN ("search_vector");
CREATE INDEX "albums_title_trgm_idx" ON "albums" USING GIN ("title" gin_trgm_ops);

-- Tracks ----------------------------------------------------------------
ALTER TABLE "tracks"
  ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("title", '')), 'A')
  ) STORED;

CREATE INDEX "tracks_search_vector_idx" ON "tracks" USING GIN ("search_vector");
CREATE INDEX "tracks_title_trgm_idx" ON "tracks" USING GIN ("title" gin_trgm_ops);

-- Partial index used to filter ready tracks fast
CREATE INDEX "tracks_ready_recent_idx"
  ON "tracks" ("createdAt" DESC)
  WHERE "status" = 'READY' AND "deletedAt" IS NULL;
