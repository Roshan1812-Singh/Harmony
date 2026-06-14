import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import type { Prisma, Track, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { slugify } from '../../common/utils/slug';
import { TRANSCODE_QUEUE } from './tracks.tokens';
import { CreateTrackDto, UpdateTrackDto } from './dto/create-track.dto';

@Injectable()
export class TracksService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(TRANSCODE_QUEUE) private readonly transcodeQueue: Queue,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Time-synced/plain lyrics for a track. For external (JioSaavn) songs we proxy
   * JioSaavn's lyrics API using the stored externalId; LOCAL tracks return null.
   */
  async getLyrics(id: string): Promise<{ lyrics: string | null }> {
    const t = await this.prisma.track.findFirst({
      where: { id, deletedAt: null },
      select: { source: true, externalId: true },
    });
    if (!t) throw new NotFoundException('Track not found');
    if (t.source !== 'SAAVN' || !t.externalId) return { lyrics: null };
    try {
      const url =
        `https://www.jiosaavn.com/api.php?__call=lyrics.getLyrics&lyrics_id=${encodeURIComponent(t.externalId)}` +
        `&ctx=web6dot0&api_version=4&_format=json&_marker=0`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) return { lyrics: null };
      const json = (await res.json()) as { lyrics?: string };
      const raw = json.lyrics ?? '';
      const lyrics = raw ? raw.replace(/<br\s*\/?>/gi, '\n').trim() : null;
      return { lyrics: lyrics || null };
    } catch {
      return { lyrics: null };
    }
  }

  /**
   * Creates a `DRAFT` track, then enqueues a transcoding job.
   * The transcoder will probe duration, validate audio, transcode, and flip status to READY.
   */
  async create(uploaderId: string, dto: CreateTrackDto): Promise<Track> {
    const artist = await this.prisma.artist.findUnique({ where: { userId: uploaderId } });
    if (!artist) throw new ForbiddenException('Only artist accounts can upload tracks');

    if (dto.albumId) {
      const album = await this.prisma.album.findUnique({ where: { id: dto.albumId } });
      if (!album || album.artistId !== artist.id) {
        throw new ForbiddenException('Album does not belong to this artist');
      }
    }

    const track = await this.prisma.track.create({
      data: {
        title: dto.title,
        slug: slugify(dto.title),
        explicit: dto.explicit ?? false,
        license: dto.license,
        sourceKey: dto.sourceKey,
        trackNumber: dto.trackNumber,
        status: 'PROCESSING',
        artist: { connect: { id: artist.id } },
        album: dto.albumId ? { connect: { id: dto.albumId } } : undefined,
        uploader: { connect: { id: uploaderId } },
        genres: dto.genreIds?.length
          ? { create: dto.genreIds.map((genreId) => ({ genre: { connect: { id: genreId } } })) }
          : undefined,
      },
    });

    await this.transcodeQueue.add(
      'transcode',
      { trackId: track.id },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: 100,
        removeOnFail: 1_000,
      },
    );

    return track;
  }

  async listPublic(filter: {
    cursor?: string;
    limit: number;
    artistId?: string;
    albumId?: string;
    genreId?: string;
  }) {
    const where: Prisma.TrackWhereInput = {
      status: 'READY',
      deletedAt: null,
      ...(filter.artistId && { artistId: filter.artistId }),
      ...(filter.albumId && { albumId: filter.albumId }),
      ...(filter.genreId && { genres: { some: { genreId: filter.genreId } } }),
    };
    const items = await this.prisma.track.findMany({
      where,
      take: filter.limit + 1,
      ...(filter.cursor && { cursor: { id: filter.cursor }, skip: 1 }),
      // Most-played first, then by (random) id. Ordering the long 0-play tail by
      // uuid scatters tracks across albums so a browse list isn't dominated by
      // whatever album was imported most recently (which made covers all repeat),
      // while keeping a stable order for cursor pagination.
      orderBy: [{ playCount: 'desc' }, { id: 'desc' }],
      include: {
        artist: { select: { id: true, displayName: true, slug: true } },
        album: { select: { id: true, title: true, slug: true, coverUrl: true } },
        artists: {
          orderBy: { position: 'asc' },
          select: { artist: { select: { id: true, displayName: true, slug: true } } },
        },
      },
    });
    const hasNext = items.length > filter.limit;
    const data = hasNext ? items.slice(0, -1) : items;
    return { data, nextCursor: hasNext ? data[data.length - 1]!.id : null };
  }

  /**
   * Home "Trending" feed. Returns one track per album (DISTINCT ON album) so the
   * grid shows a variety of covers instead of many songs from whatever album was
   * imported most recently. Prefers most-played, then newest.
   */
  async trending(limit: number) {
    // Dedupe on the cover image: film soundtracks are split into several
    // per-artist album records that all reuse the same poster, so collapsing by
    // cover (rather than albumId) is what actually guarantees a varied grid.
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM (
        SELECT DISTINCT ON (t."coverUrl") t.id, t."playCount", t."createdAt"
        FROM "tracks" t
        WHERE t."status" = 'READY' AND t."deletedAt" IS NULL AND t."coverUrl" IS NOT NULL
        ORDER BY t."coverUrl", t."playCount" DESC, t."createdAt" DESC
      ) s
      ORDER BY s."playCount" DESC, s."createdAt" DESC
      LIMIT ${limit}
    `;
    const ids = rows.map((r) => r.id);
    if (ids.length === 0) return { data: [], nextCursor: null };
    const tracks = await this.prisma.track.findMany({
      where: { id: { in: ids } },
      include: {
        artist: { select: { id: true, displayName: true, slug: true } },
        album: { select: { id: true, title: true, slug: true, coverUrl: true } },
        artists: {
          orderBy: { position: 'asc' },
          select: { artist: { select: { id: true, displayName: true, slug: true } } },
        },
      },
    });
    const byId = new Map(tracks.map((t) => [t.id, t]));
    const data = ids.map((id) => byId.get(id)).filter(Boolean);
    return { data, nextCursor: null };
  }

  async getById(id: string) {
    const t = await this.prisma.track.findFirst({
      where: { id, deletedAt: null },
      include: {
        artist: true,
        album: true,
        genres: { include: { genre: true } },
      },
    });
    if (!t) throw new NotFoundException('Track not found');
    return t;
  }

  async update(trackId: string, actorId: string, actorRole: UserRole, dto: UpdateTrackDto) {
    const t = await this.assertEditable(trackId, actorId, actorRole);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.track.update({
        where: { id: t.id },
        data: {
          title: dto.title,
          slug: dto.title ? slugify(dto.title) : undefined,
          explicit: dto.explicit,
          license: dto.license,
        },
      });
      if (dto.genreIds) {
        await tx.trackGenre.deleteMany({ where: { trackId: t.id } });
        if (dto.genreIds.length) {
          await tx.trackGenre.createMany({
            data: dto.genreIds.map((genreId) => ({ trackId: t.id, genreId })),
          });
        }
      }
      this.events.emit('track.updated', { trackId: t.id });
      return updated;
    });
  }

  async softDelete(trackId: string, actorId: string, actorRole: UserRole) {
    await this.assertEditable(trackId, actorId, actorRole);
    await this.prisma.track.update({
      where: { id: trackId },
      data: { deletedAt: new Date() },
    });
    this.events.emit('track.deleted', { trackId });
  }

  private async assertEditable(trackId: string, actorId: string, actorRole: UserRole) {
    const t = await this.prisma.track.findFirst({
      where: { id: trackId, deletedAt: null },
      include: { artist: true },
    });
    if (!t) throw new NotFoundException('Track not found');
    const isOwner = t.artist.userId === actorId;
    if (!isOwner && actorRole !== 'ADMIN') {
      throw new ForbiddenException('Not your track');
    }
    return t;
  }
}
