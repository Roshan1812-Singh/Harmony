-- Many-to-many between tracks and artists so a song appears under every
-- credited artist (Spotify-style), not just its first/lead credit.
-- Applied via `prisma db execute` to avoid db push touching search_vector columns.

CREATE TABLE IF NOT EXISTS "track_artists" (
  "trackId"  UUID    NOT NULL,
  "artistId" UUID    NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "role"     TEXT    NOT NULL DEFAULT 'primary',
  CONSTRAINT "track_artists_pkey" PRIMARY KEY ("trackId", "artistId"),
  CONSTRAINT "track_artists_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks" ("id") ON DELETE CASCADE,
  CONSTRAINT "track_artists_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "artists" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "track_artists_artistId_idx" ON "track_artists" ("artistId");
