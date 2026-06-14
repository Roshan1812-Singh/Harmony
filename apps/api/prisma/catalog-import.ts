/**
 * Catalog importer — populates the database with a large, real, searchable music
 * catalog from the iTunes Search API (free, no key). Every track gets a playable
 * ~30s preview URL (audioUrl), real cover art, album/soundtrack and artist info.
 *
 *   pnpm --filter @harmony/api catalog:import
 *
 * Idempotent: tracks are upserted on (source, externalId), so re-running tops up
 * the catalog without creating duplicates. Respects iTunes rate limits with a delay.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient, type License } from '@prisma/client';

// ── Load DATABASE_URL from apps/api/.env (no dotenv dependency needed) ──────────
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

const prisma = new PrismaClient();
const LICENSE: License = 'ROYALTY_FREE';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'untitled'
  );
}

function bigArt(url: string | undefined): string | null {
  if (!url) return null;
  return url.replace(/\/\d+x\d+bb?\./, '/600x600bb.');
}

interface ItunesSong {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackTimeMillis?: number;
  primaryGenreName?: string;
  releaseDate?: string;
  kind?: string;
}

// Curated search terms. {term, country}. Country IN surfaces Indian / Bollywood film songs.
const TERMS: Array<{ q: string; country?: string }> = [
  // Global pop / chart
  { q: 'Taylor Swift' }, { q: 'Ed Sheeran' }, { q: 'The Weeknd' }, { q: 'Drake' },
  { q: 'Billie Eilish' }, { q: 'Adele' }, { q: 'Bruno Mars' }, { q: 'Coldplay' },
  { q: 'Imagine Dragons' }, { q: 'Dua Lipa' }, { q: 'Post Malone' }, { q: 'Ariana Grande' },
  { q: 'Justin Bieber' }, { q: 'Rihanna' }, { q: 'Eminem' }, { q: 'Beyonce' },
  { q: 'Maroon 5' }, { q: 'Shawn Mendes' }, { q: 'Harry Styles' }, { q: 'Olivia Rodrigo' },
  { q: 'Sia' }, { q: 'Katy Perry' }, { q: 'Lady Gaga' }, { q: 'Sam Smith' },
  { q: 'Charlie Puth' }, { q: 'Kanye West' }, { q: 'Travis Scott' }, { q: 'Doja Cat' },
  // K-pop
  { q: 'BTS' }, { q: 'BLACKPINK' }, { q: 'Stray Kids' },
  // Bollywood / Indian (country IN)
  { q: 'Arijit Singh', country: 'IN' }, { q: 'Shreya Ghoshal', country: 'IN' },
  { q: 'A R Rahman', country: 'IN' }, { q: 'Pritam', country: 'IN' },
  { q: 'Atif Aslam', country: 'IN' }, { q: 'Neha Kakkar', country: 'IN' },
  { q: 'Sonu Nigam', country: 'IN' }, { q: 'Lata Mangeshkar', country: 'IN' },
  { q: 'Kishore Kumar', country: 'IN' }, { q: 'Badshah', country: 'IN' },
  { q: 'Diljit Dosanjh', country: 'IN' }, { q: 'Jubin Nautiyal', country: 'IN' },
  { q: 'Darshan Raval', country: 'IN' }, { q: 'Honey Singh', country: 'IN' },
  { q: 'Sachin-Jigar', country: 'IN' }, { q: 'Vishal-Shekhar', country: 'IN' },
  { q: 'Anirudh Ravichander', country: 'IN' },
  // Indian films / soundtracks (country IN) — search by film name
  { q: 'Kabir Singh', country: 'IN' }, { q: 'Aashiqui 2', country: 'IN' },
  { q: 'Dilwale Dulhania Le Jayenge', country: 'IN' }, { q: 'Kal Ho Naa Ho', country: 'IN' },
  { q: 'Rockstar', country: 'IN' }, { q: 'Bajirao Mastani', country: 'IN' },
  { q: 'Brahmastra', country: 'IN' }, { q: 'Pathaan', country: 'IN' },
  { q: 'Animal', country: 'IN' }, { q: 'Jawan', country: 'IN' },
  { q: 'RRR', country: 'IN' }, { q: 'Pushpa', country: 'IN' },
  // Hollywood film soundtracks
  { q: 'Frozen soundtrack' }, { q: 'Titanic soundtrack' }, { q: 'La La Land soundtrack' },
  { q: 'Top Gun Maverick soundtrack' }, { q: 'Interstellar soundtrack' },
  { q: 'The Greatest Showman' }, { q: 'Guardians of the Galaxy soundtrack' },
  { q: 'Encanto soundtrack' }, { q: 'Barbie the Album' },
  // Genres / moods
  { q: 'lofi hip hop' }, { q: 'jazz classics' }, { q: 'classical music' },
  { q: 'rock anthems' }, { q: 'hip hop hits' }, { q: 'edm dance' },
  { q: 'country music' }, { q: 'reggae' }, { q: 'heavy metal' }, { q: 'blues' },
  { q: 'acoustic' }, { q: 'r&b soul' }, { q: 'indie pop' }, { q: 'electronic chill' },
  // Eras
  { q: '80s hits' }, { q: '90s hits' }, { q: '2000s pop' }, { q: '2010s hits' },
];

async function getSystemUploaderId(): Promise<string> {
  const u = await prisma.user.upsert({
    where: { email: 'catalog@harmony.local' },
    update: {},
    create: {
      email: 'catalog@harmony.local',
      displayName: 'Harmony Catalog',
      role: 'ADMIN',
      emailVerifiedAt: new Date(),
    },
  });
  return u.id;
}

const artistCache = new Map<string, string>();
const albumCache = new Map<string, string>();
const genreCache = new Map<string, string>();

async function upsertArtist(name: string): Promise<string> {
  const slug = slugify(name);
  if (artistCache.has(slug)) return artistCache.get(slug)!;
  const a = await prisma.artist.upsert({
    where: { slug },
    update: {},
    create: { displayName: name, slug, verified: true },
  });
  artistCache.set(slug, a.id);
  return a.id;
}

async function upsertAlbum(
  artistId: string,
  title: string,
  coverUrl: string | null,
  releaseDate: string | undefined,
): Promise<string> {
  const slug = slugify(title);
  const key = `${artistId}:${slug}`;
  if (albumCache.has(key)) return albumCache.get(key)!;
  const al = await prisma.album.upsert({
    where: { artistId_slug: { artistId, slug } },
    update: { coverUrl: coverUrl ?? undefined },
    create: {
      artistId,
      title,
      slug,
      coverUrl,
      license: LICENSE,
      releaseDate: releaseDate ? new Date(releaseDate) : null,
    },
  });
  albumCache.set(key, al.id);
  return al.id;
}

async function upsertGenre(name: string): Promise<string> {
  const slug = slugify(name);
  if (genreCache.has(slug)) return genreCache.get(slug)!;
  const g = await prisma.genre.upsert({
    where: { slug },
    update: {},
    create: { name, slug },
  });
  genreCache.set(slug, g.id);
  return g.id;
}

async function importTerm(
  uploaderId: string,
  term: { q: string; country?: string },
): Promise<number> {
  const url =
    `https://itunes.apple.com/search?term=${encodeURIComponent(term.q)}` +
    `&media=music&entity=song&limit=200&country=${term.country ?? 'US'}`;
  let songs: ItunesSong[] = [];
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'HarmonyCatalog/1.0' } });
    if (!res.ok) {
      console.warn(`  ! ${term.q}: HTTP ${res.status}`);
      return 0;
    }
    const json = (await res.json()) as { results?: ItunesSong[] };
    songs = json.results ?? [];
  } catch (e) {
    console.warn(`  ! ${term.q}: ${(e as Error).message}`);
    return 0;
  }

  let added = 0;
  for (const s of songs) {
    if (s.kind !== 'song' || !s.trackId || !s.trackName || !s.artistName || !s.previewUrl) continue;
    try {
      const artistId = await upsertArtist(s.artistName);
      const cover = bigArt(s.artworkUrl100);
      const albumId = s.collectionName
        ? await upsertAlbum(artistId, s.collectionName, cover, s.releaseDate)
        : null;

      const track = await prisma.track.upsert({
        where: { source_externalId: { source: 'ITUNES', externalId: String(s.trackId) } },
        update: { audioUrl: s.previewUrl, coverUrl: cover ?? undefined },
        create: {
          title: s.trackName,
          slug: slugify(s.trackName),
          artistId,
          albumId,
          uploaderId,
          durationMs: s.trackTimeMillis ?? 30000,
          license: LICENSE,
          status: 'READY',
          sourceKey: '',
          coverUrl: cover,
          source: 'ITUNES',
          externalId: String(s.trackId),
          audioUrl: s.previewUrl,
          downloadable: true,
          previewSec: 30,
        },
      });

      if (s.primaryGenreName) {
        const genreId = await upsertGenre(s.primaryGenreName);
        await prisma.trackGenre.upsert({
          where: { trackId_genreId: { trackId: track.id, genreId } },
          update: {},
          create: { trackId: track.id, genreId },
        });
      }
      added++;
    } catch (e) {
      // Unique slug collisions etc. — skip the offending row, keep going.
      if (process.env.CATALOG_DEBUG) console.warn(`    skip "${s.trackName}": ${(e as Error).message}`);
    }
  }
  return added;
}

async function main() {
  console.log(`▶ Importing catalog from iTunes (${TERMS.length} terms)…`);
  const uploaderId = await getSystemUploaderId();
  let total = 0;
  for (let i = 0; i < TERMS.length; i++) {
    const term = TERMS[i];
    if (!term) continue;
    const n = await importTerm(uploaderId, term);
    total += n;
    console.log(`  [${i + 1}/${TERMS.length}] ${term.q}${term.country ? ` (${term.country})` : ''} → +${n} (total ${total})`);
    await sleep(1500); // be gentle with iTunes rate limits
  }
  const count = await prisma.track.count({ where: { source: 'ITUNES' } });
  console.log(`✅ Catalog import complete. ITUNES tracks in DB: ${count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
