-- Additive schema changes for the external catalog (iTunes / Deezer / Jamendo).
-- Applied via `prisma db execute` so the generated `search_vector` tsvector
-- columns are left untouched (db push would try to drop them).

ALTER TABLE "artists" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "tracks" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'LOCAL';
ALTER TABLE "tracks" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "tracks" ADD COLUMN IF NOT EXISTS "audioUrl" TEXT;
ALTER TABLE "tracks" ADD COLUMN IF NOT EXISTS "downloadable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tracks" ADD COLUMN IF NOT EXISTS "isrc" TEXT;
ALTER TABLE "tracks" ADD COLUMN IF NOT EXISTS "previewSec" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "tracks_source_externalId_key" ON "tracks" ("source", "externalId");
CREATE INDEX IF NOT EXISTS "tracks_source_idx" ON "tracks" ("source");
