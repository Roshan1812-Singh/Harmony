import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { Client } from '@elastic/elasticsearch';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ES_CLIENT } from './search.tokens';

export interface SearchHit {
  type: 'track' | 'album' | 'artist';
  id: string;
  title: string;
  subtitle?: string;
  coverUrl?: string | null;
  slug?: string;
  score: number;
  // Track-only extras so the web client can enqueue/play results directly.
  durationMs?: number;
  artistId?: string;
  artistName?: string;
  artistSlug?: string;
  albumId?: string;
  albumTitle?: string;
}

const TRACK_INDEX = 'harmony-tracks';
const ALBUM_INDEX = 'harmony-albums';
const ARTIST_INDEX = 'harmony-artists';

/**
 * Multi-entity search. Elasticsearch when available; otherwise Postgres FTS.
 * The fallback path keeps the API responsive in dev (no ES) and during ES outages in prod.
 */
@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(ES_CLIENT) private readonly es: Client | null,
  ) {}

  async search(query: string, types: Array<'track' | 'album' | 'artist'>): Promise<SearchHit[]> {
    if (!query.trim()) return [];
    if (this.es) {
      try {
        const hits = await this.searchEs(query, types);
        // Empty ES results (e.g. an unindexed catalog) must not mask the DB —
        // fall through to Postgres FTS so search always reflects real tracks.
        if (hits.length > 0) return hits;
      } catch (err) {
        this.logger.warn(`ES query failed, falling back to PG: ${(err as Error).message}`);
      }
    }
    return this.searchPg(query, types);
  }

  async autocomplete(prefix: string, limit = 8): Promise<SearchHit[]> {
    if (!prefix.trim()) return [];
    // Trigram similarity ranks short prefixes well across artists/albums/tracks.
    const rows = await this.prisma.$queryRaw<
      Array<{ type: string; id: string; title: string; slug: string; cover_url: string | null; score: number }>
    >`
      SELECT 'artist' AS type, id, "displayName" AS title, slug, "coverUrl" AS cover_url,
             similarity("displayName", ${prefix})::float AS score
        FROM "artists"
        WHERE "displayName" % ${prefix}
      UNION ALL
      SELECT 'album', id, title, slug, "coverUrl",
             similarity(title, ${prefix})::float
        FROM "albums"
        WHERE "deletedAt" IS NULL AND title % ${prefix}
      UNION ALL
      SELECT 'track', id, title, slug, NULL,
             similarity(title, ${prefix})::float
        FROM "tracks"
        WHERE "deletedAt" IS NULL AND "status" = 'READY' AND title % ${prefix}
      ORDER BY score DESC
      LIMIT ${limit}`;
    return rows.map((r) => ({
      type: r.type as SearchHit['type'],
      id: r.id,
      title: r.title,
      slug: r.slug,
      coverUrl: r.cover_url,
      score: r.score,
    }));
  }

  private async searchEs(query: string, types: SearchHit['type'][]): Promise<SearchHit[]> {
    const indices = types
      .map((t) => (t === 'track' ? TRACK_INDEX : t === 'album' ? ALBUM_INDEX : ARTIST_INDEX))
      .join(',');
    const res = await this.es!.search<{ type: string; title: string; subtitle?: string; coverUrl?: string; slug?: string }>({
      index: indices,
      query: {
        multi_match: {
          query,
          fields: ['title^3', 'subtitle^1.5', 'artistName^1.5', 'albumTitle'],
          fuzziness: 'AUTO',
        },
      },
      size: 30,
    });
    return res.hits.hits.map((h) => ({
      type: (h._source?.type ?? 'track') as SearchHit['type'],
      id: h._id!,
      title: h._source!.title,
      subtitle: h._source!.subtitle,
      coverUrl: h._source!.coverUrl ?? null,
      slug: h._source!.slug,
      score: h._score ?? 0,
    }));
  }

  private async searchPg(query: string, types: SearchHit['type'][]): Promise<SearchHit[]> {
    const out: SearchHit[] = [];

    if (types.includes('artist')) {
      const rows = await this.prisma.$queryRaw<
        Array<{ id: string; displayName: string; slug: string; cover_url: string | null; score: number }>
      >`
        SELECT id, "displayName", slug, "coverUrl" AS cover_url,
               ts_rank(search_vector, websearch_to_tsquery('simple', ${query}))::float AS score
          FROM "artists"
          WHERE search_vector @@ websearch_to_tsquery('simple', ${query})
          ORDER BY score DESC
          LIMIT 10`;
      out.push(...rows.map((r) => ({
        type: 'artist' as const,
        id: r.id,
        title: r.displayName,
        slug: r.slug,
        coverUrl: r.cover_url,
        score: r.score,
      })));
    }

    if (types.includes('album')) {
      const rows = await this.prisma.$queryRaw<
        Array<{ id: string; title: string; slug: string; cover_url: string | null; score: number }>
      >`
        SELECT id, title, slug, "coverUrl" AS cover_url,
               ts_rank(search_vector, websearch_to_tsquery('simple', ${query}))::float AS score
          FROM "albums"
          WHERE "deletedAt" IS NULL AND search_vector @@ websearch_to_tsquery('simple', ${query})
          ORDER BY score DESC
          LIMIT 10`;
      out.push(...rows.map((r) => ({
        type: 'album' as const,
        id: r.id,
        title: r.title,
        slug: r.slug,
        coverUrl: r.cover_url,
        score: r.score,
      })));
    }

    if (types.includes('track')) {
      // Match on track title, artist name, OR album/soundtrack (film) title, so a
      // query like an artist or movie name returns the relevant songs directly.
      const rows = await this.prisma.$queryRaw<
        Array<{
          id: string;
          title: string;
          slug: string;
          cover_url: string | null;
          duration_ms: number;
          artist_id: string;
          artist_name: string;
          artist_slug: string;
          album_id: string | null;
          album_title: string | null;
          score: number;
        }>
      >`
        SELECT t.id, t.title, t.slug, t."coverUrl" AS cover_url, t."durationMs" AS duration_ms,
               a.id AS artist_id, a."displayName" AS artist_name, a.slug AS artist_slug,
               al.id AS album_id, al.title AS album_title,
               GREATEST(
                 similarity(t.title, ${query}),
                 similarity(a."displayName", ${query}),
                 COALESCE(similarity(al.title, ${query}), 0)
               )::float AS score
          FROM "tracks" t
          JOIN "artists" a ON a.id = t."artistId"
          LEFT JOIN "albums" al ON al.id = t."albumId"
          WHERE t."deletedAt" IS NULL AND t."status" = 'READY'
            AND (
              t.title ILIKE '%' || ${query} || '%'
              OR a."displayName" ILIKE '%' || ${query} || '%'
              OR al.title ILIKE '%' || ${query} || '%'
            )
          ORDER BY score DESC, t."playCount" DESC
          LIMIT 40`;
      out.push(...rows.map((r) => ({
        type: 'track' as const,
        id: r.id,
        title: r.title,
        subtitle: r.album_title ? `${r.artist_name} • ${r.album_title}` : r.artist_name,
        slug: r.slug,
        coverUrl: r.cover_url,
        score: r.score,
        durationMs: r.duration_ms,
        artistId: r.artist_id,
        artistName: r.artist_name,
        artistSlug: r.artist_slug,
        albumId: r.album_id ?? undefined,
        albumTitle: r.album_title ?? undefined,
      })));
    }

    return out.sort((a, b) => b.score - a.score);
  }
}
