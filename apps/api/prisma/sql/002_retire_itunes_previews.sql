-- Retire the iTunes 30-second preview tracks now that full-length JioSaavn songs
-- exist. Soft-delete (set deletedAt) keeps referential integrity (playlist items,
-- likes, history) intact while hiding them from search, home, and listings, which
-- all filter on `deletedAt IS NULL`.
UPDATE "tracks" SET "deletedAt" = now() WHERE "source" = 'ITUNES' AND "deletedAt" IS NULL;
