import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type Redis from 'ioredis';
import { PLAYBACK_MIN_COUNT_MS } from '@harmony/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { S3Service } from '../../common/s3/s3.service';
import { MetricsService } from '../../common/metrics/metrics.service';
import { REDIS_CLIENT } from '../../common/redis/redis.module';
import { LibraryService } from '../library/library.service';

export interface StreamManifest {
  trackId: string;
  format: 'hls' | 'mp3';
  url: string;
  expiresAt: string;
  durationMs: number;
}

@Injectable()
export class StreamingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly metrics: MetricsService,
    private readonly library: LibraryService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Returns a signed URL pointing at either the HLS master playlist (preferred for browsers)
   * or the 256k MP3 fallback. The URL is valid for 1 hour.
   */
  async getManifest(trackId: string, prefer: 'hls' | 'mp3' = 'hls'): Promise<StreamManifest> {
    const t = await this.prisma.track.findFirst({
      where: { id: trackId, deletedAt: null, status: 'READY' },
      select: { id: true, durationMs: true, streamKey: true, source: true, audioUrl: true },
    });
    if (!t) throw new NotFoundException('Track not playable');

    // External catalog (iTunes / Deezer / Jamendo): the audio is a direct, publicly
    // playable URL — hand it to the player as-is (browsers play m4a/mp3 natively).
    if (t.source !== 'LOCAL' && t.audioUrl) {
      return {
        trackId: t.id,
        format: 'mp3',
        url: t.audioUrl,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        durationMs: t.durationMs,
      };
    }

    if (!t.streamKey) throw new NotFoundException('Track not playable');
    const key = prefer === 'hls' ? `${t.streamKey}hls/master.m3u8` : `${t.streamKey}mp3-256.mp3`;
    const url = await this.s3.signStreamUrl(key, 3600);
    return {
      trackId: t.id,
      format: prefer,
      url,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      durationMs: t.durationMs,
    };
  }

  /**
   * Resolves a track to a directly-fetchable audio URL + metadata, for the download
   * proxy. External tracks use their audioUrl; local tracks get a signed MP3 URL.
   */
  async getDownloadTarget(
    trackId: string,
  ): Promise<{ url: string; filename: string; contentType: string }> {
    const t = await this.prisma.track.findFirst({
      where: { id: trackId, deletedAt: null, status: 'READY' },
      select: { title: true, slug: true, streamKey: true, source: true, audioUrl: true },
    });
    if (!t) throw new NotFoundException('Track not found');

    let url: string;
    let ext: string;
    let contentType: string;
    if (t.source !== 'LOCAL' && t.audioUrl) {
      url = t.audioUrl;
      ext = t.audioUrl.includes('.m4a') ? 'm4a' : t.audioUrl.includes('.mp3') ? 'mp3' : 'm4a';
      contentType = ext === 'mp3' ? 'audio/mpeg' : 'audio/mp4';
    } else if (t.streamKey) {
      url = await this.s3.signStreamUrl(`${t.streamKey}mp3-256.mp3`, 3600);
      ext = 'mp3';
      contentType = 'audio/mpeg';
    } else {
      throw new NotFoundException('Track not downloadable');
    }
    const safe = (t.slug || t.title || 'track').replace(/[^a-z0-9-_]+/gi, '_').slice(0, 80);
    return { url, filename: `${safe}.${ext}`, contentType };
  }

  /**
   * Resolves a track's cover art to a directly-fetchable URL, for the same-origin
   * cover proxy used by offline downloads (avoids CDN CORS restrictions).
   */
  async getCoverTarget(trackId: string): Promise<{ url: string; contentType: string }> {
    const t = await this.prisma.track.findFirst({
      where: { id: trackId, deletedAt: null },
      select: { coverUrl: true, album: { select: { coverUrl: true } } },
    });
    const url = t?.coverUrl ?? t?.album?.coverUrl;
    if (!url) throw new NotFoundException('No cover art');
    const ext = url.split('?')[0]?.split('.').pop()?.toLowerCase();
    const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    return { url, contentType };
  }

  /**
   * Called by the web player every ~15s. Increments aggregate playCount only after the
   * user has crossed the 30s threshold, debounced per user/track via Redis SETNX.
   */
  async heartbeat(args: {
    userId: string | null;
    trackId: string;
    msPlayed: number;
    ip: string;
  }): Promise<void> {
    if (args.msPlayed < PLAYBACK_MIN_COUNT_MS) return;

    const dedupeKey = `play:dedupe:${args.userId ?? hashIp(args.ip)}:${args.trackId}:${Math.floor(Date.now() / 600_000)}`;
    const first = await this.redis.set(dedupeKey, '1', 'EX', 600, 'NX');
    if (!first) return; // Already counted this user/track in the last 10 minutes.

    const track = await this.prisma.track.update({
      where: { id: args.trackId },
      data: { playCount: { increment: 1 } },
      select: { license: true },
    });
    this.metrics.playbacks.inc({ license: track.license });

    if (args.userId) {
      await this.library.recordPlay(args.userId, args.trackId);
    }

    // PlaybackSession: lightweight write for analytics.
    await this.prisma.playbackSession
      .create({
        data: {
          userId: args.userId,
          trackId: args.trackId,
          msPlayed: args.msPlayed,
          endedAt: new Date(),
          ipHash: hashIp(args.ip),
          client: 'web',
        },
      })
      .catch(() => undefined);
  }
}

function hashIp(ip: string): string {
  const salt = new Date().toISOString().slice(0, 10);
  return createHash('sha256').update(`${ip}:${salt}`).digest('hex').slice(0, 32);
}
