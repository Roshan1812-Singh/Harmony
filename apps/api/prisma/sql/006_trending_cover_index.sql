-- Supports the home "Trending" query: SELECT DISTINCT ON ("coverUrl") ...
-- ORDER BY "coverUrl", "playCount" DESC, "createdAt" DESC. A matching partial
-- btree lets Postgres satisfy the DISTINCT ON via an index scan instead of a
-- full sort of every track.
CREATE INDEX IF NOT EXISTS "tracks_trending_cover"
  ON "tracks" ("coverUrl", "playCount" DESC, "createdAt" DESC)
  WHERE "status" = 'READY' AND "deletedAt" IS NULL AND "coverUrl" IS NOT NULL;
