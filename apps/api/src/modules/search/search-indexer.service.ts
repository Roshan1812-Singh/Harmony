import { Inject, Injectable, Logger, Optional, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { Client, estypes } from '@elastic/elasticsearch';
import type { Track, Artist, Album, Genre, TrackGenre } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ES_CLIENT } from './search.tokens';

const TRACK_INDEX = 'harmony-tracks';
const ALBUM_INDEX = 'harmony-albums';
const ARTIST_INDEX = 'harmony-artists';

type TrackFull = Track & {
  artist: Artist;
  album: Album | null;
  genres: (TrackGenre & { genre: Genre })[];
};

/**
 * Listens for domain events (`track.updated`, `track.deleted`) and writes to ES.
 * If ES is unavailable, this is a no-op — the search read path will fall back to PG FTS.
 */
@Injectable()
export class SearchIndexerService implements OnModuleInit {
  private readonly logger = new Logger(SearchIndexerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(ES_CLIENT) private readonly es: Client | null,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.es) return;
    await this.ensureIndices();
  }

  async indexTrack(t: TrackFull): Promise<void> {
    if (!this.es) return;
    await this.es.index({
      index: TRACK_INDEX,
      id: t.id,
      document: {
        type: 'track',
        title: t.title,
        slug: t.slug,
        durationMs: t.durationMs,
        artistId: t.artistId,
        artistName: t.artist.displayName,
        albumId: t.albumId,
        albumTitle: t.album?.title,
        genres: t.genres.map((g) => g.genre.name),
        license: t.license,
        playCount: Number(t.playCount),
        createdAt: t.createdAt.toISOString(),
        coverUrl: t.album?.coverUrl ?? t.coverUrl,
      },
    });
  }

  @OnEvent('track.deleted')
  async onTrackDeleted({ trackId }: { trackId: string }) {
    if (!this.es) return;
    await this.es.delete({ index: TRACK_INDEX, id: trackId }).catch(() => undefined);
  }

  @OnEvent('track.updated')
  async onTrackUpdated({ trackId }: { trackId: string }) {
    if (!this.es) return;
    const t = await this.prisma.track.findUnique({
      where: { id: trackId },
      include: { artist: true, album: true, genres: { include: { genre: true } } },
    });
    if (!t || t.status !== 'READY') return;
    await this.indexTrack(t);
  }

  private async ensureIndices(): Promise<void> {
    if (!this.es) return;
    const create = async (name: string, props: Record<string, estypes.MappingProperty>) => {
      const exists = await this.es!.indices.exists({ index: name });
      if (exists) return;
      await this.es!.indices.create({
        index: name,
        settings: { analysis: { analyzer: { default: { type: 'standard' } } } },
        mappings: { properties: props },
      });
      this.logger.log(`created index ${name}`);
    };

    await create(TRACK_INDEX, {
      type: { type: 'keyword' },
      title: { type: 'text' },
      slug: { type: 'keyword' },
      artistId: { type: 'keyword' },
      artistName: { type: 'text' },
      albumId: { type: 'keyword' },
      albumTitle: { type: 'text' },
      genres: { type: 'keyword' },
      license: { type: 'keyword' },
      playCount: { type: 'long' },
      createdAt: { type: 'date' },
      coverUrl: { type: 'keyword' },
    });
    await create(ALBUM_INDEX, {
      type: { type: 'keyword' },
      title: { type: 'text' },
      slug: { type: 'keyword' },
      artistId: { type: 'keyword' },
      artistName: { type: 'text' },
      coverUrl: { type: 'keyword' },
    });
    await create(ARTIST_INDEX, {
      type: { type: 'keyword' },
      title: { type: 'text' },
      slug: { type: 'keyword' },
      coverUrl: { type: 'keyword' },
    });
  }
}
