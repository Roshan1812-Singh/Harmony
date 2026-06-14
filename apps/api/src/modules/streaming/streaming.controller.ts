import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, ParseUUIDPipe, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, IsUUID, Min } from 'class-validator';
import { Readable } from 'node:stream';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { StreamingService } from './streaming.service';

class HeartbeatDto {
  @IsUUID() trackId!: string;
  @IsInt() @Min(0) msPlayed!: number;
}

@ApiTags('streaming')
@Controller('stream')
export class StreamingController {
  constructor(private readonly streaming: StreamingService) {}

  @Public()
  @Get(':trackId/manifest')
  @ApiOperation({
    summary: 'Get a signed CloudFront URL for the requested track + format.',
    description:
      'Returns either an HLS master playlist URL (browsers via hls.js / Safari) or a 256k MP3 URL. ' +
      'Both support HTTP range requests at the CDN/S3 layer.',
  })
  manifest(
    @Param('trackId', ParseUUIDPipe) trackId: string,
    @Query('format') format: 'hls' | 'mp3' = 'hls',
  ) {
    return this.streaming.getManifest(trackId, format === 'mp3' ? 'mp3' : 'hls');
  }

  @Public()
  @Get(':trackId/file')
  @ApiOperation({
    summary: 'Same-origin audio proxy — used for downloads and offline caching.',
    description: 'Streams the track audio through the API so the browser can cache it for offline playback. Pass ?dl=1 to force a file download.',
  })
  async file(
    @Param('trackId', ParseUUIDPipe) trackId: string,
    @Query('dl') dl: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const target = await this.streaming.getDownloadTarget(trackId);
    const upstream = await fetch(target.url);
    if (!upstream.ok || !upstream.body) {
      throw new NotFoundException('Audio source unavailable');
    }
    res.setHeader('Content-Type', target.contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    const len = upstream.headers.get('content-length');
    if (len) res.setHeader('Content-Length', len);
    if (dl) res.setHeader('Content-Disposition', `attachment; filename="${target.filename}"`);
    Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
  }

  @Public()
  @Get(':trackId/cover')
  @ApiOperation({ summary: 'Same-origin cover-art proxy — used for offline download caching.' })
  async cover(
    @Param('trackId', ParseUUIDPipe) trackId: string,
    @Res() res: Response,
  ): Promise<void> {
    const target = await this.streaming.getCoverTarget(trackId);
    const upstream = await fetch(target.url);
    if (!upstream.ok || !upstream.body) {
      throw new NotFoundException('Cover art unavailable');
    }
    res.setHeader('Content-Type', target.contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    const len = upstream.headers.get('content-length');
    if (len) res.setHeader('Content-Length', len);
    Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
  }

  @ApiCookieAuth()
  @UseGuards(JwtAuthGuard)
  @Post('heartbeat')
  @HttpCode(HttpStatus.NO_CONTENT)
  heartbeat(
    @CurrentUser() user: AuthUser,
    @Body() dto: HeartbeatDto,
    @Req() req: Request,
  ) {
    return this.streaming.heartbeat({
      userId: user.id,
      trackId: dto.trackId,
      msPlayed: dto.msPlayed,
      ip: (req.ip ?? '0.0.0.0').toString(),
    });
  }
}
