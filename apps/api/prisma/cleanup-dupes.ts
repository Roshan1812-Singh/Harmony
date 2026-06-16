/**
 * Catalog cleanup: remove low-quality INSTRUMENTAL COVER compilations that flood the
 * UI with one repeated album image per volume (anime "PianoBox" / "Music Box" /
 * "オルゴール" / "Animusic Box" / orchestral cover series by labels like "Relaxu",
 * "Relaxu Box", "Pharozen"). These aren't real songs with their own artwork — each
 * compilation volume reuses a single cover across all its tracks.
 *
 * Real artists / albums / soundtracks are NOT touched.
 *
 * Inspect (default, read-only):
 *   pnpm --filter @harmony/api exec tsx prisma/cleanup-dupes.ts
 * Apply the deletion:
 *   pnpm --filter @harmony/api exec tsx prisma/cleanup-dupes.ts --apply
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';

function loadEnv() {
  if (process.env.DATABASE_URL) return;
  try {
    const raw = readFileSync(join(process.cwd(), '.env'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      const key = m?.[1];
      if (key && !process.env[key]) process.env[key] = (m?.[2] ?? '').replace(/^["']|["']$/g, '');
    }
  } catch {
    /* ignore */
  }
}
loadEnv();

const APPLY = process.argv.includes('--apply');
const prisma = new PrismaClient();

// Known instrumental cover-compilation labels (exact, case-insensitive).
const COVER_ARTISTS = ['Relaxu', 'Relaxu Box', 'Pharozen'];

// Compilation-series markers that appear in album/track titles. These series exist
// only to host single-cover instrumental covers of other works.
const SERIES_MARKERS = [
  'PianoBox',
  'Animusic Box',
  'オルゴール',
  'Anime Meets Orchestral',
  'Once Upon a Wish Collection',
];

const trackFilter: Prisma.TrackWhereInput = {
  OR: [
    { artist: { displayName: { in: COVER_ARTISTS, mode: 'insensitive' } } },
    ...SERIES_MARKERS.flatMap((s): Prisma.TrackWhereInput[] => [
      { title: { contains: s, mode: 'insensitive' } },
      { album: { title: { contains: s, mode: 'insensitive' } } },
    ]),
  ],
};

async function main() {
  const totalTracks = await prisma.track.count();
  const totalAlbums = await prisma.album.count();
  console.log(`Catalog: ${totalTracks} tracks, ${totalAlbums} albums\n`);

  const toRemove = await prisma.track.count({ where: trackFilter });

  // Show the cover-artists and a few sample titles for sanity.
  const artists = await prisma.artist.findMany({
    where: { displayName: { in: COVER_ARTISTS, mode: 'insensitive' } },
    select: { displayName: true, _count: { select: { tracks: true, albums: true } } },
  });
  console.log('Cover-compilation artists found:');
  for (const a of artists) console.log(`  ${a.displayName}: ${a._count.tracks} tracks, ${a._count.albums} albums`);

  const samples = await prisma.track.findMany({
    where: trackFilter,
    select: { title: true, artist: { select: { displayName: true } } },
    take: 5,
  });
  console.log('\nSample tracks to remove:');
  for (const s of samples) console.log(`  "${s.title}" — ${s.artist.displayName}`);

  console.log(`\nWould remove ${toRemove} tracks (of ${totalTracks}).`);

  if (!APPLY) {
    console.log('\nDry run only. Re-run with --apply to delete.');
    return;
  }

  const del = await prisma.track.deleteMany({ where: trackFilter });
  // Remove albums/artists left empty by the deletion.
  const emptyAlbums = await prisma.$executeRaw`
    DELETE FROM albums al WHERE NOT EXISTS (SELECT 1 FROM tracks t WHERE t."albumId" = al.id)
  `;
  const orphanArtists = await prisma.$executeRaw`
    DELETE FROM artists a
    WHERE a."userId" IS NULL
      AND NOT EXISTS (SELECT 1 FROM tracks t WHERE t."artistId" = a.id)
      AND NOT EXISTS (SELECT 1 FROM albums al WHERE al."artistId" = a.id)
  `;
  const after = await prisma.track.count();
  console.log(`\nDeleted ${del.count} tracks, ${emptyAlbums} empty albums, ${orphanArtists} orphaned artists.`);
  console.log(`Catalog now has ${after} tracks (was ${totalTracks}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
