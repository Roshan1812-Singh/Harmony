-- Give albums an external catalog identity so imported soundtracks map to ONE
-- album shared across every credited artist (instead of one album per lead artist).
ALTER TABLE "albums" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'LOCAL';
ALTER TABLE "albums" ADD COLUMN IF NOT EXISTS "externalId" TEXT;

-- Composite unique used by the importer's upsert. NULL externalId rows (local
-- albums) are treated as distinct by Postgres, so they never collide.
CREATE UNIQUE INDEX IF NOT EXISTS "albums_source_externalId_key"
  ON "albums" ("source", "externalId");
