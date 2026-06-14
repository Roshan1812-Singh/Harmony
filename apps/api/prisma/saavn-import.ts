/**
 * Full-length, multi-language catalog importer (JioSaavn).
 *
 * Unlike the iTunes importer (30s previews, English-heavy), this pulls FULL songs
 * with directly-streamable 320kbps URLs across many languages — Hindi, Tamil,
 * Telugu, Punjabi, Bhojpuri, Bengali, Marathi, Kannada, Malayalam, English,
 * plus a few international languages.
 *
 *   pnpm --filter @harmony/api saavn:import
 *
 * JioSaavn returns an `encrypted_media_url` (DES-ECB, key "38346591"). We decrypt it
 * to the CDN URL (aac.saavncdn.com), which serves full songs with `Access-Control-
 * Allow-Origin: *` and HTTP range support — so the browser streams & downloads it
 * directly. DES-ECB is a legacy cipher under OpenSSL 3, so run with
 * NODE_OPTIONS=--openssl-legacy-provider (the npm script sets this).
 *
 * Each song's `language` is recorded as a Genre, powering the language browse tiles.
 * Idempotent: tracks upsert on (source, externalId).
 */
import crypto from 'node:crypto';
import os from 'node:os';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient, type License } from '@prisma/client';

function loadEnv() {
  if (process.env.DATABASE_URL) return;
  try {
    const raw = readFileSync(join(process.cwd(), '.env'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* ignore */
  }
}
loadEnv();

const prisma = new PrismaClient();
const LICENSE: License = 'ROYALTY_FREE';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Throttle / resume knobs (all overridable via env). Defaults are deliberately
// gentle so the running API stays responsive while the import works in the bg.
const SEARCH_DELAY = Number(process.env.SAAVN_SEARCH_DELAY_MS) || 300;
const ALBUM_DELAY = Number(process.env.SAAVN_ALBUM_DELAY_MS) || 450;
const ALBUM_REST_EVERY = Number(process.env.SAAVN_ALBUM_REST_EVERY) || 30;
const ALBUM_REST_MS = Number(process.env.SAAVN_ALBUM_REST_MS) || 4000;
// When set, pass 1 only discovers album ids (no song writes) — used on resume,
// since the search songs were already imported on the first run.
const DISCOVER_ONLY = process.env.SAAVN_DISCOVER_ONLY === '1';

// Resumable state persisted to disk so a restart picks up where it left off.
// Kept in the OS temp dir (NOT under apps/api) so the API's file watcher doesn't
// restart the server every time we checkpoint progress.
const CACHE_DIR = join(os.tmpdir(), 'harmony-saavn-cache');
function loadIdSet(file: string): Set<string> {
  try {
    return new Set(JSON.parse(readFileSync(join(CACHE_DIR, file), 'utf8')) as string[]);
  } catch {
    return new Set<string>();
  }
}
function saveIdSet(file: string, set: Set<string>): void {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(join(CACHE_DIR, file), JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

function decryptMediaUrl(encrypted: string): string {
  const key = Buffer.from('38346591', 'utf8');
  const dec = crypto.createDecipheriv('des-ecb', key, null);
  dec.setAutoPadding(true);
  return dec.update(Buffer.from(encrypted, 'base64'), undefined, 'utf8') + dec.final('utf8');
}

const ENTITIES: Record<string, string> = {
  quot: '"', amp: '&', apos: "'", lt: '<', gt: '>', '#39': "'", '#039': "'", '#34': '"', nbsp: ' ',
};
function decode(s: string | undefined): string {
  if (!s) return '';
  return s
    .replace(/&(#x?[0-9a-f]+|[a-z0-9]+);/gi, (m, code: string) => {
      if (code[0] === '#') {
        const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(n) ? String.fromCodePoint(n) : m;
      }
      return ENTITIES[code.toLowerCase()] ?? m;
    })
    .trim();
}

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
  return url.replace(/\d+x\d+(?=\.\w+$)/, '500x500');
}

function titleCase(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
}

interface SaavnSong {
  id: string;
  title?: string;
  image?: string;
  more_info?: {
    album?: string;
    album_id?: string;
    duration?: string;
    language?: string;
    '320kbps'?: string;
    encrypted_media_url?: string;
    artistMap?: { primary_artists?: Array<{ id: string; name: string }> };
  };
}

// Seed queries grouped by language. JioSaavn search is global; querying the top
// artists / film names of each language reliably surfaces that language's catalog.
// `lang` is the language we tag the resulting songs with (search results often
// omit the language field), which powers the language browse tiles.
const TERMS: Array<{ q: string; lang: string }> = [
  // Hindi / Bollywood — singers, composers, rappers, films, eras
  ...['Arijit Singh', 'Shreya Ghoshal', 'Atif Aslam', 'Neha Kakkar', 'Jubin Nautiyal',
    'Sonu Nigam', 'Kishore Kumar', 'Lata Mangeshkar', 'Mohammed Rafi', 'Udit Narayan',
    'Sunidhi Chauhan', 'KK', 'Mohit Chauhan', 'Darshan Raval', 'B Praak', 'Pritam',
    'A R Rahman', 'Vishal Mishra', 'Tanishk Bagchi', 'Sachet Tandon', 'Armaan Malik',
    'Shaan', 'Alka Yagnik', 'Kumar Sanu', 'Asha Bhosle', 'Rahat Fateh Ali Khan',
    'Vishal-Shekhar', 'Shankar-Ehsaan-Loy', 'Amit Trivedi', 'Sachin-Jigar', 'Mithoon',
    'Ankit Tiwari', 'Palak Muchhal', 'Stebin Ben', 'Yo Yo Honey Singh', 'Badshah',
    'Raftaar', 'Divine', 'Emiway Bantai', 'King', 'Seedhe Maut', 'AP Dhillon hindi',
    'Top Hindi songs', 'Bollywood hits', 'Bollywood romantic', 'Bollywood party',
    'Bollywood 90s', 'Bollywood 2000s', '90s Hindi hits', 'old Hindi songs',
    'Animal', 'Jawan', 'Pathaan', 'Kabir Singh', 'Aashiqui 2', 'Rockstar', 'Brahmastra',
    'Tum Hi Ho', 'Kesariya', 'Dilwale', 'Yeh Jawaani Hai Deewani', 'Ae Dil Hai Mushkil',
    'Tamasha', 'Sanam Teri Kasam', 'Arjun Reddy', 'Shershaah', 'Gangubai', 'Stree',
    'Bajirao Mastani', 'Padmaavat', 'Goliyon Ki Raasleela Ram-Leela', 'Dhadak',
    'Kal Ho Naa Ho', 'Kabhi Khushi Kabhie Gham', 'Dil To Pagal Hai', 'Devdas'].map((q) => ({ q, lang: 'Hindi' })),
  // Punjabi
  ...['Diljit Dosanjh', 'Sidhu Moose Wala', 'AP Dhillon', 'Karan Aujla', 'Guru Randhawa',
    'Ammy Virk', 'Shubh', 'Jass Manak', 'B Praak punjabi', 'Ranjit Bawa', 'Gurnam Bhullar',
    'Babbu Maan', 'Amrinder Gill', 'Hardy Sandhu', 'Jasmine Sandlas', 'Nimrat Khaira',
    'Satinder Sartaaj', 'Top Punjabi songs', 'Punjabi hits', 'Punjabi party'].map((q) => ({ q, lang: 'Punjabi' })),
  // Tamil
  ...['Anirudh Ravichander', 'Yuvan Shankar Raja', 'Ilaiyaraaja', 'S P Balasubrahmanyam',
    'Sid Sriram', 'Harris Jayaraj', 'D Imman', 'Santhosh Narayanan', 'G V Prakash Kumar',
    'Top Tamil songs', 'Tamil hits', 'Leo', 'Vikram tamil', 'Master tamil', 'Kaththi',
    'Mersal', 'Bigil', 'Vada Chennai', 'Ponniyin Selvan', 'Jailer'].map((q) => ({ q, lang: 'Tamil' })),
  // Telugu
  ...['Devi Sri Prasad', 'S S Thaman', 'Sid Sriram telugu', 'M M Keeravani', 'Mickey J Meyer',
    'Top Telugu songs', 'Telugu hits', 'RRR', 'Pushpa', 'Saripodhaa Sanivaaram', 'Arjun Reddy telugu',
    'Ala Vaikunthapurramuloo', 'Sita Ramam', 'Baahubali', 'Salaar'].map((q) => ({ q, lang: 'Telugu' })),
  // Bhojpuri
  ...['Pawan Singh', 'Khesari Lal Yadav', 'Nirahua', 'Ritesh Pandey', 'Pramod Premi',
    'Arvind Akela Kallu', 'Top Bhojpuri songs', 'Bhojpuri hits', 'Bhojpuri DJ'].map((q) => ({ q, lang: 'Bhojpuri' })),
  // Bengali
  ...['Top Bengali songs', 'Rabindra Sangeet', 'Bengali hits', 'Anupam Roy',
    'Arijit Singh bengali', 'Bengali modern', 'Bengali adhunik'].map((q) => ({ q, lang: 'Bengali' })),
  // Marathi
  ...['Top Marathi songs', 'Ajay Atul', 'Marathi hits', 'Marathi koligeet',
    'Avadhoot Gupte', 'Marathi lavani'].map((q) => ({ q, lang: 'Marathi' })),
  // Kannada
  ...['Top Kannada songs', 'Vijay Prakash', 'Kannada hits', 'Arjun Janya',
    'V Harikrishna', 'KGF kannada'].map((q) => ({ q, lang: 'Kannada' })),
  // Malayalam
  ...['Top Malayalam songs', 'Malayalam hits', 'Vidyasagar', 'Gopi Sundar',
    'Sushin Shyam', 'M Jayachandran'].map((q) => ({ q, lang: 'Malayalam' })),
  // Other Indian languages
  ...['Top Gujarati songs', 'Gujarati garba', 'Gujarati hits'].map((q) => ({ q, lang: 'Gujarati' })),
  ...['Rajasthani songs', 'Rajasthani hits'].map((q) => ({ q, lang: 'Rajasthani' })),
  ...['Haryanvi songs', 'Haryanvi hits', 'Sapna Choudhary'].map((q) => ({ q, lang: 'Haryanvi' })),
  ...['Assamese songs', 'Zubeen Garg'].map((q) => ({ q, lang: 'Assamese' })),
  ...['Odia songs', 'Odia hits'].map((q) => ({ q, lang: 'Odia' })),
  ...['Urdu ghazal', 'Nusrat Fateh Ali Khan', 'Ghulam Ali', 'Mehdi Hassan', 'Coke Studio Pakistan'].map((q) => ({ q, lang: 'Urdu' })),
  // English / global — pop, rock, hip-hop, decades
  ...['Taylor Swift', 'Ed Sheeran', 'The Weeknd', 'Drake', 'Billie Eilish', 'Adele',
    'Bruno Mars', 'Coldplay', 'Imagine Dragons', 'Dua Lipa', 'Post Malone', 'Ariana Grande',
    'Justin Bieber', 'Eminem', 'Rihanna', 'Beyonce', 'Katy Perry', 'Maroon 5', 'Shawn Mendes',
    'Harry Styles', 'Olivia Rodrigo', 'Lady Gaga', 'Sam Smith', 'Charlie Puth', 'Sia',
    'Travis Scott', 'Kendrick Lamar', 'Kanye West', 'Doja Cat', 'SZA', 'Linkin Park',
    'Imagine Dragons', 'Maroon 5', 'OneRepublic', 'Twenty One Pilots', 'Arctic Monkeys',
    'Queen', 'The Beatles', 'Michael Jackson', 'Elton John', 'Nirvana', 'Metallica',
    'Top English songs', 'English hits', 'pop hits', 'rock classics', 'hip hop hits',
    'edm dance', 'rnb soul', 'country music', '80s hits', '90s hits', '2000s pop', '2010s hits',
    'lofi', 'jazz classics', 'workout songs', 'party anthems'].map((q) => ({ q, lang: 'English' })),
  // International
  ...['BTS', 'BLACKPINK', 'Top Korean songs', 'kpop hits', 'Stray Kids', 'TWICE', 'SEVENTEEN'].map((q) => ({ q, lang: 'Korean' })),
  ...['Spanish songs', 'Bad Bunny', 'Shakira', 'Daddy Yankee', 'reggaeton', 'Latin hits'].map((q) => ({ q, lang: 'Spanish' })),
  ...['French songs', 'French pop', 'Stromae'].map((q) => ({ q, lang: 'French' })),
  ...['German songs', 'German pop'].map((q) => ({ q, lang: 'German' })),
  ...['Arabic songs', 'Arabic pop', 'Amr Diab'].map((q) => ({ q, lang: 'Arabic' })),
  ...['Japanese songs', 'jpop hits', 'anime songs'].map((q) => ({ q, lang: 'Japanese' })),
];

async function getSystemUploaderId(): Promise<string> {
  const u = await prisma.user.upsert({
    where: { email: 'catalog@harmony.local' },
    update: {},
    create: { email: 'catalog@harmony.local', displayName: 'Harmony Catalog', role: 'ADMIN', emailVerifiedAt: new Date() },
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

// JioSaavn sometimes returns a single "primary artist" entry that actually packs
// several credits ("Pritam, Arijit Singh & Amitabh Bhattacharya"). Split those so
// each real artist gets their own page. We deliberately do NOT split on hyphens —
// duos like "Vishal-Shekhar" / "Sachin-Jigar" are single acts.
function splitNames(name?: string): string[] {
  if (!name) return [];
  return name
    .split(/\s*(?:,|&|;|\bfeat\.?\b|\bft\.?\b)\s*/i)
    .map((t) => t.trim())
    .filter(Boolean);
}

function parseArtistNames(mi?: SaavnSong['more_info']): string[] {
  const raw = (mi?.artistMap?.primary_artists ?? []).flatMap((a) => splitNames(decode(a?.name)));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of raw) {
    const s = slugify(n);
    if (!n || !s || seen.has(s)) continue;
    seen.add(s);
    out.push(n);
    if (out.length >= 6) break; // cap fan-out
  }
  return out;
}

// Albums are keyed by the JioSaavn album id so a film soundtrack maps to ONE
// album shared across every credited artist, instead of one fragmented album per
// lead singer. `ownerArtistId` is only used when first creating the record.
async function upsertAlbum(
  externalId: string,
  ownerArtistId: string,
  title: string,
  coverUrl: string | null,
): Promise<string> {
  if (albumCache.has(externalId)) return albumCache.get(externalId)!;
  const al = await prisma.album.upsert({
    where: { source_externalId: { source: 'SAAVN', externalId } },
    update: { coverUrl: coverUrl ?? undefined, title },
    create: {
      artistId: ownerArtistId,
      title,
      slug: slugify(title),
      coverUrl,
      license: LICENSE,
      source: 'SAAVN',
      externalId,
    },
  });
  albumCache.set(externalId, al.id);
  return al.id;
}

async function upsertGenre(name: string): Promise<string> {
  const slug = slugify(name);
  if (genreCache.has(slug)) return genreCache.get(slug)!;
  const g = await prisma.genre.upsert({ where: { slug }, update: {}, create: { name, slug } });
  genreCache.set(slug, g.id);
  return g.id;
}

// Imports a single JioSaavn song object. Returns true if it was newly added or
// refreshed. When `albumIds` is supplied, the song's album id is recorded so the
// album-expansion pass can later pull in every track of that album.
async function processSong(
  uploaderId: string,
  s: SaavnSong,
  termLang: string,
  albumIds?: Set<string>,
): Promise<boolean> {
  const mi = s.more_info;
  const enc = mi?.encrypted_media_url;
  const artistNames = parseArtistNames(mi);
  const title = decode(s.title);
  if (!s.id || !enc || !title || artistNames.length === 0) return false;
  if (albumIds && mi?.album_id) albumIds.add(mi.album_id);
  try {
    let audioUrl = decryptMediaUrl(enc);
    if (mi?.['320kbps'] === 'true') audioUrl = audioUrl.replace('_96.mp4', '_320.mp4');
    if (!audioUrl.startsWith('http')) return false;

    // Upsert every credited artist; the first is the lead (used as the row's
    // primary artist + album owner), all are linked via track_artists.
    const artistIds: string[] = [];
    for (const n of artistNames) artistIds.push(await upsertArtist(n));
    const leadId = artistIds[0]!;
    const cover = bigArt(s.image);
    const albumTitle = decode(mi?.album);
    const albumExtId = mi?.album_id;
    const albumId =
      albumExtId && albumTitle ? await upsertAlbum(albumExtId, leadId, albumTitle, cover) : null;
    const durationMs = (Number(mi?.duration) || 210) * 1000;

    const track = await prisma.track.upsert({
      where: { source_externalId: { source: 'SAAVN', externalId: s.id } },
      // Re-point existing tracks onto the unified album (but never wipe an album
      // we couldn't resolve this pass).
      update: { audioUrl, coverUrl: cover ?? undefined, durationMs, artistId: leadId, albumId: albumId ?? undefined },
      create: {
        title,
        slug: slugify(title),
        artistId: leadId,
        albumId,
        uploaderId,
        durationMs,
        license: LICENSE,
        status: 'READY',
        sourceKey: '',
        coverUrl: cover,
        source: 'SAAVN',
        externalId: s.id,
        audioUrl,
        downloadable: true,
      },
    });

    // Link the track to every credited artist (Spotify-style multi-artist).
    for (let ai = 0; ai < artistIds.length; ai++) {
      await prisma.trackArtist.upsert({
        where: { trackId_artistId: { trackId: track.id, artistId: artistIds[ai]! } },
        update: { position: ai },
        create: { trackId: track.id, artistId: artistIds[ai]!, position: ai, role: ai === 0 ? 'primary' : 'featured' },
      });
    }

    // Prefer the song's own language when present; otherwise use the term's
    // language. Either way every track gets a language genre for browsing.
    const lang = mi?.language ? titleCase(mi.language) : termLang;
    if (lang) {
      const genreId = await upsertGenre(lang);
      await prisma.trackGenre.upsert({
        where: { trackId_genreId: { trackId: track.id, genreId } },
        update: {},
        create: { trackId: track.id, genreId },
      });
    }
    return true;
  } catch (e) {
    if (process.env.CATALOG_DEBUG) console.warn(`    skip "${title}": ${(e as Error).message}`);
    return false;
  }
}

async function importTerm(
  uploaderId: string,
  q: string,
  termLang: string,
  page: number,
  albumIds: Set<string>,
): Promise<number> {
  const url =
    `https://www.jiosaavn.com/api.php?__call=search.getResults&q=${encodeURIComponent(q)}` +
    `&_format=json&_marker=0&api_version=4&ctx=web6dot0&n=50&p=${page}`;
  let songs: SaavnSong[] = [];
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return 0;
    const json = (await res.json()) as { results?: SaavnSong[] };
    songs = json.results ?? [];
  } catch {
    return 0;
  }

  let added = 0;
  for (const s of songs) {
    const aid = s.more_info?.album_id;
    if (aid) albumIds.add(aid);
    // In discover-only mode we skip the (already-done) song writes and just
    // collect album ids to feed the album-expansion pass.
    if (!DISCOVER_ONLY && (await processSong(uploaderId, s, termLang))) added++;
  }
  return added;
}

const albumDone = new Set<string>();

// Pulls the FULL tracklist of one album so we capture every song, not just the
// few that surfaced in search results.
async function importAlbum(uploaderId: string, albumId: string): Promise<number> {
  if (albumDone.has(albumId)) return 0;
  albumDone.add(albumId);
  const url =
    `https://www.jiosaavn.com/api.php?__call=content.getAlbumDetails&albumid=${encodeURIComponent(albumId)}` +
    `&_format=json&_marker=0&api_version=4&ctx=web6dot0`;
  let songs: SaavnSong[] = [];
  let albumLang = '';
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return 0;
    const json = (await res.json()) as {
      songs?: SaavnSong[];
      list?: SaavnSong[];
      language?: string;
      more_info?: { language?: string };
    };
    songs = json.songs ?? json.list ?? [];
    albumLang = json.language ?? json.more_info?.language ?? '';
  } catch {
    return 0;
  }
  const fallbackLang = albumLang ? titleCase(albumLang) : '';
  let added = 0;
  for (const s of songs) if (await processSong(uploaderId, s, fallbackLang)) added++;
  return added;
}

async function main() {
  // Fail fast with a clear message if the legacy cipher provider isn't enabled.
  try {
    crypto.createDecipheriv('des-ecb', Buffer.from('38346591', 'utf8'), null);
  } catch {
    console.error('DES-ECB unavailable. Run with NODE_OPTIONS=--openssl-legacy-provider (the saavn:import script sets this).');
    process.exit(1);
  }

  const PAGES = [1, 2, 3, 4, 5];
  const uploaderId = await getSystemUploaderId();
  const albumIds = loadIdSet('albums.json');
  const done = loadIdSet('albums-done.json');
  let total = 0;

  console.log(
    `▶ JioSaavn import — ${TERMS.length} terms × ${PAGES.length} pages` +
      `${DISCOVER_ONLY ? ' (discover-only)' : ''}; resuming with ${albumIds.size} known albums, ${done.size} already expanded.`,
  );

  // Pass 1 — search terms. Collects album ids referenced by every hit (and, when
  // not in discover-only mode, imports the search songs themselves).
  for (let i = 0; i < TERMS.length; i++) {
    const { q, lang } = TERMS[i];
    let n = 0;
    for (const page of PAGES) {
      n += await importTerm(uploaderId, q, lang, page, albumIds);
      await sleep(SEARCH_DELAY);
    }
    total += n;
    if ((i + 1) % 10 === 0 || i === TERMS.length - 1) {
      saveIdSet('albums.json', albumIds);
      console.log(`  [${i + 1}/${TERMS.length}] ${q} (${lang}) → +${n} (albums known ${albumIds.size})`);
    }
  }
  saveIdSet('albums.json', albumIds);

  // Pass 2 — expand every not-yet-done album to its complete tracklist, throttled
  // with periodic rests so the live API stays responsive. Progress is persisted
  // so a restart resumes from here instead of redoing finished albums.
  const queue = [...albumIds].filter((id) => !done.has(id));
  console.log(`▶ Expanding ${queue.length} remaining albums (of ${albumIds.size}) to full tracklists…`);
  for (let i = 0; i < queue.length; i++) {
    total += await importAlbum(uploaderId, queue[i]!);
    done.add(queue[i]!);
    await sleep(ALBUM_DELAY);
    if ((i + 1) % ALBUM_REST_EVERY === 0) {
      saveIdSet('albums-done.json', done);
      await sleep(ALBUM_REST_MS); // breathe — let the API serve requests
      console.log(`  albums [${i + 1}/${queue.length}] → tracks processed ${total}`);
    }
  }
  saveIdSet('albums-done.json', done);

  const count = await prisma.track.count({ where: { source: 'SAAVN' } });
  console.log(`✅ JioSaavn import complete. SAAVN tracks in DB: ${count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
