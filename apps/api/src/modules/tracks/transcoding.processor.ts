import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { parseFile } from 'music-metadata';
import type { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MetricsService } from '../../common/metrics/metrics.service';
import { SearchIndexerService } from '../search/search-indexer.service';
import type { AppConfig } from '../../config/configuration';
import { S3_CLIENT } from '../../common/s3/s3.tokens';
import { Inject } from '@nestjs/common';
import { TRANSCODE_QUEUE } from './tracks.tokens';

interface TranscodeJob {
  trackId: string;
}

/**
 * Pulls a track's source from S3, runs ffmpeg to produce:
 *   – mp3-128k.mp3
 *   – mp3-256k.mp3
 *   – hls/playlist.m3u8 + segments (AAC at 96k & 192k variants)
 * Then writes outputs back to S3 (`stream/<id>/...`), records duration/peaks,
 * flips the track to READY, and indexes it in search.
 *
 * Failure modes:
 *   – ffprobe says no audio stream → set REJECTED.
 *   – Any other error → retried up to 3 times via BullMQ.
 */
@Injectable()
@Processor(TRANSCODE_QUEUE, { concurrency: 2 })
export class TranscodingProcessor extends WorkerHost {
  private readonly logger = new Logger(TranscodingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly metrics: MetricsService,
    private readonly indexer: SearchIndexerService,
    @Inject(S3_CLIENT) private readonly s3: S3Client,
  ) {
    super();
  }

  async process(job: Job<TranscodeJob>): Promise<void> {
    const track = await this.prisma.track.findUnique({
      where: { id: job.data.trackId },
      include: { artist: true, album: true },
    });
    if (!track) throw new Error(`Track ${job.data.trackId} not found`);

    const s3 = this.config.get('s3', { infer: true });
    const workdir = join(tmpdir(), `harmony-${track.id}`);
    await mkdir(workdir, { recursive: true });

    try {
      const srcPath = join(workdir, 'source');
      await this.downloadFromS3(s3.bucketRaw, track.sourceKey, srcPath);

      const probed = await parseFile(srcPath, { duration: true });
      if (!probed.format.duration) {
        await this.markRejected(track.id, 'No audio stream found');
        this.metrics.transcodingJobs.inc({ outcome: 'rejected' });
        return;
      }

      const durationMs = Math.round(probed.format.duration * 1000);
      const streamPrefix = `stream/${track.id}`;

      await runFfmpeg([
        '-y',
        '-i', srcPath,
        '-vn',
        '-codec:a', 'libmp3lame',
        '-b:a', '128k',
        join(workdir, 'mp3-128.mp3'),
      ]);
      await runFfmpeg([
        '-y',
        '-i', srcPath,
        '-vn',
        '-codec:a', 'libmp3lame',
        '-b:a', '256k',
        join(workdir, 'mp3-256.mp3'),
      ]);

      // HLS — two AAC variants + master playlist
      await mkdir(join(workdir, 'hls'), { recursive: true });
      await runFfmpeg([
        '-y',
        '-i', srcPath,
        '-vn',
        '-c:a', 'aac', '-b:a', '96k',
        '-hls_time', '6',
        '-hls_playlist_type', 'vod',
        '-hls_segment_filename', join(workdir, 'hls', '96-%03d.ts'),
        join(workdir, 'hls', '96.m3u8'),
      ]);
      await runFfmpeg([
        '-y',
        '-i', srcPath,
        '-vn',
        '-c:a', 'aac', '-b:a', '192k',
        '-hls_time', '6',
        '-hls_playlist_type', 'vod',
        '-hls_segment_filename', join(workdir, 'hls', '192-%03d.ts'),
        join(workdir, 'hls', '192.m3u8'),
      ]);
      const master = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-STREAM-INF:BANDWIDTH=110000,CODECS="mp4a.40.2"',
        '96.m3u8',
        '#EXT-X-STREAM-INF:BANDWIDTH=220000,CODECS="mp4a.40.2"',
        '192.m3u8',
        '',
      ].join('\n');
      await writeFile(join(workdir, 'hls', 'master.m3u8'), master);

      // Upload all artefacts in one walk
      await this.uploadDir(s3.bucketStream, streamPrefix, workdir);

      const updated = await this.prisma.track.update({
        where: { id: track.id },
        data: { status: 'READY', durationMs, streamKey: `${streamPrefix}/` },
        include: { artist: true, album: true, genres: { include: { genre: true } } },
      });

      await this.indexer.indexTrack(updated);
      this.metrics.transcodingJobs.inc({ outcome: 'success' });
      this.logger.log(`✅ track ${track.id} transcoded (${durationMs}ms)`);
    } catch (err) {
      this.logger.error(`transcode failed for track ${track.id}: ${(err as Error).message}`);
      this.metrics.transcodingJobs.inc({ outcome: 'failed' });
      throw err;
    } finally {
      await rm(workdir, { recursive: true, force: true });
    }
  }

  private async downloadFromS3(bucket: string, key: string, dest: string): Promise<void> {
    const obj = await this.s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const body = obj.Body as Readable | undefined;
    if (!body) throw new Error(`S3 object empty: ${bucket}/${key}`);
    await new Promise<void>((resolve, reject) => {
      const ws = createWriteStream(dest);
      body.on('error', reject);
      ws.on('error', reject);
      ws.on('close', () => resolve());
      body.pipe(ws);
    });
  }

  private async uploadDir(bucket: string, keyPrefix: string, localDir: string): Promise<void> {
    const walk = async (dir: string, relPrefix = ''): Promise<void> => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          await walk(full, rel);
          continue;
        }
        // skip the raw source
        if (entry.name === 'source') continue;
        const body = await readFile(full);
        await this.s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: `${keyPrefix}/${rel}`,
            Body: body,
            ContentType: contentTypeFor(entry.name),
            CacheControl: 'public, max-age=604800, immutable',
          }),
        );
      }
    };
    await walk(localDir);
  }

  private async markRejected(trackId: string, reason: string): Promise<void> {
    await this.prisma.track.update({
      where: { id: trackId },
      data: { status: 'REJECTED' },
    });
    this.logger.warn(`track ${trackId} rejected: ${reason}`);
  }
}

function contentTypeFor(name: string): string {
  if (name.endsWith('.mp3')) return 'audio/mpeg';
  if (name.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
  if (name.endsWith('.ts')) return 'video/mp2t';
  return 'application/octet-stream';
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    p.stderr.on('data', (d) => (stderr += d.toString()));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-500)}`))));
  });
}
