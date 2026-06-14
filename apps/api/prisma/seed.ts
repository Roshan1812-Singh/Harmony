/**
 * Idempotent seed script.
 *
 *   pnpm --filter @harmony/api db:seed
 *
 * Creates a small but realistic dataset: 1 admin, 1 demo user, 1 verified artist
 * with an album of 3 CC0 tracks, plus the canonical genre taxonomy.
 *
 * Tracks reference fake source keys; in dev MinIO they won't actually play unless
 * you upload sample audio under those keys. The transcoder also won't process
 * pre-seeded tracks (status starts as READY) — this is intentional.
 */
import { PrismaClient, type License, type UserRole } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const GENRES = [
  { name: 'Ambient',      slug: 'ambient' },
  { name: 'Classical',    slug: 'classical' },
  { name: 'Electronic',   slug: 'electronic' },
  { name: 'Folk',         slug: 'folk' },
  { name: 'Hip-Hop',      slug: 'hip-hop' },
  { name: 'Indie',        slug: 'indie' },
  { name: 'Jazz',         slug: 'jazz' },
  { name: 'Lo-Fi',        slug: 'lofi' },
  { name: 'Metal',        slug: 'metal' },
  { name: 'Pop',          slug: 'pop' },
  { name: 'Rock',         slug: 'rock' },
  { name: 'World',        slug: 'world' },
];

async function upsertUser(input: {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
  verified?: boolean;
}) {
  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  return prisma.user.upsert({
    where: { email: input.email },
    update: { displayName: input.displayName, role: input.role },
    create: {
      email: input.email,
      passwordHash,
      displayName: input.displayName,
      role: input.role,
      emailVerifiedAt: input.verified ? new Date() : null,
    },
  });
}

async function main() {
  console.log('▶ Seeding genres');
  for (const g of GENRES) {
    await prisma.genre.upsert({ where: { slug: g.slug }, update: {}, create: g });
  }

  console.log('▶ Seeding users');
  const admin = await upsertUser({
    email: process.env.SEED_ADMIN_EMAIL ?? 'admin@harmony.local',
    password: process.env.SEED_ADMIN_PASSWORD ?? 'Admin!234',
    displayName: 'Harmony Admin',
    role: 'ADMIN',
    verified: true,
  });

  await upsertUser({
    email: 'demo@harmony.local',
    password: 'Demo!2345',
    displayName: 'Demo Listener',
    role: 'USER',
    verified: true,
  });

  const artistUser = await upsertUser({
    email: 'artist@harmony.local',
    password: 'Artist!2345',
    displayName: 'Open Source Studio',
    role: 'ARTIST',
    verified: true,
  });

  console.log('▶ Seeding artist profile');
  const artist = await prisma.artist.upsert({
    where: { userId: artistUser.id },
    update: {},
    create: {
      userId: artistUser.id,
      displayName: 'Open Source Studio',
      slug: 'open-source-studio',
      bio: 'A demo artist releasing music under permissive licences.',
      verified: true,
      monthlyListeners: 1234,
    },
  });

  console.log('▶ Seeding album + tracks');
  const license: License = 'CC0';
  const album = await prisma.album.upsert({
    where: { artistId_slug: { artistId: artist.id, slug: 'first-light' } },
    update: {},
    create: {
      artistId: artist.id,
      title: 'First Light',
      slug: 'first-light',
      releaseDate: new Date('2025-09-12'),
      license,
    },
  });

  const ambient = await prisma.genre.findUniqueOrThrow({ where: { slug: 'ambient' } });
  const electronic = await prisma.genre.findUniqueOrThrow({ where: { slug: 'electronic' } });

  const trackSeeds = [
    { title: 'Drifting',  slug: 'drifting',  trackNumber: 1, durationMs: 192_000 },
    { title: 'Cirrus',    slug: 'cirrus',    trackNumber: 2, durationMs: 214_000 },
    { title: 'Halcyon',   slug: 'halcyon',   trackNumber: 3, durationMs: 245_000 },
  ];

  for (const seed of trackSeeds) {
    const t = await prisma.track.upsert({
      where: { id: `00000000-0000-7000-8000-000000000${seed.trackNumber}00` },
      update: {},
      create: {
        id: `00000000-0000-7000-8000-000000000${seed.trackNumber}00`,
        title: seed.title,
        slug: seed.slug,
        trackNumber: seed.trackNumber,
        durationMs: seed.durationMs,
        license,
        status: 'READY',
        artistId: artist.id,
        albumId: album.id,
        uploaderId: artistUser.id,
        sourceKey: `raw/seed/${seed.slug}.mp3`,
        streamKey: `stream/seed/${seed.slug}/`,
      },
    });
    await prisma.trackGenre.upsert({
      where: { trackId_genreId: { trackId: t.id, genreId: ambient.id } },
      update: {},
      create: { trackId: t.id, genreId: ambient.id },
    });
    await prisma.trackGenre.upsert({
      where: { trackId_genreId: { trackId: t.id, genreId: electronic.id } },
      update: {},
      create: { trackId: t.id, genreId: electronic.id },
    });
  }

  console.log(`✅ Seed complete. Admin: ${admin.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
