import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { RECENTLY_PLAYED_CAP } from '@harmony/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { REDIS_CLIENT } from '../../common/redis/redis.module';

@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Records a recently-played event. We mirror to Redis for fast reads (LPUSH/LTRIM)
   * and to Postgres for durable analytics.
   */
  async recordPlay(userId: string, trackId: string): Promise<void> {
    await Promise.all([
      this.prisma.recentlyPlayed.create({ data: { userId, trackId } }),
      (async () => {
        const key = `recent:${userId}`;
        await this.redis
          .multi()
          .lpush(key, trackId)
          .ltrim(key, 0, RECENTLY_PLAYED_CAP - 1)
          .expire(key, 60 * 60 * 24 * 30)
          .exec();
      })(),
    ]);
  }

  async listRecentlyPlayed(userId: string, limit = 50) {
    // Try Redis first.
    const ids = await this.redis.lrange(`recent:${userId}`, 0, limit - 1);
    if (ids.length > 0) {
      const tracks = await this.prisma.track.findMany({
        where: { id: { in: ids }, deletedAt: null, status: 'READY' },
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
      return ids.map((id) => byId.get(id)).filter(Boolean);
    }

    // Fall back to Postgres (also rehydrates the Redis list).
    const rows = await this.prisma.recentlyPlayed.findMany({
      where: { userId },
      orderBy: { playedAt: 'desc' },
      take: limit,
      include: {
        track: {
          include: {
            artist: { select: { id: true, displayName: true, slug: true } },
            album: { select: { id: true, title: true, slug: true, coverUrl: true } },
            artists: {
              orderBy: { position: 'asc' },
              select: { artist: { select: { id: true, displayName: true, slug: true } } },
            },
          },
        },
      },
    });

    if (rows.length > 0) {
      const key = `recent:${userId}`;
      await this.redis
        .multi()
        .del(key)
        .rpush(key, ...rows.map((r) => r.trackId))
        .expire(key, 60 * 60 * 24 * 30)
        .exec();
    }
    return rows.map((r) => r.track);
  }

  async listLiked(userId: string, cursor: string | undefined, limit: number) {
    const items = await this.prisma.like.findMany({
      where: { userId },
      take: limit + 1,
      ...(cursor && {
        cursor: { userId_trackId: { userId, trackId: cursor } },
        skip: 1,
      }),
      orderBy: { createdAt: 'desc' },
      include: {
        track: {
          include: {
            artist: { select: { id: true, displayName: true, slug: true } },
            album: { select: { id: true, title: true, coverUrl: true } },
            artists: {
              orderBy: { position: 'asc' },
              select: { artist: { select: { id: true, displayName: true, slug: true } } },
            },
          },
        },
      },
    });
    const hasNext = items.length > limit;
    const data = (hasNext ? items.slice(0, -1) : items).map((r) => r.track);
    return { data, nextCursor: hasNext ? data[data.length - 1]!.id : null };
  }
}
