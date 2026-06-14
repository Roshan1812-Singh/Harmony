-- Speed up the Postgres fallback search. The track query filters with
-- `ILIKE '%q%'` and ranks with `similarity()` on track title, artist name and
-- album title. GIN trigram indexes (pg_trgm is already enabled) turn those
-- substring scans from a full table scan into an index lookup — critical now
-- that the catalog holds tens of thousands of tracks.

CREATE INDEX IF NOT EXISTS "tracks_title_trgm" ON "tracks" USING gin ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "artists_displayName_trgm" ON "artists" USING gin ("displayName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "albums_title_trgm" ON "albums" USING gin ("title" gin_trgm_ops);
