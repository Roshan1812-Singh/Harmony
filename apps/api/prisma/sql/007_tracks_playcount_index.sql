-- Supports the browse/list ordering: ORDER BY "playCount" DESC, "id" DESC over
-- playable tracks (with cursor pagination). Avoids a full sort of the catalog.
CREATE INDEX IF NOT EXISTS "tracks_playcount_id"
  ON "tracks" ("playCount" DESC, "id" DESC)
  WHERE "status" = 'READY' AND "deletedAt" IS NULL;
