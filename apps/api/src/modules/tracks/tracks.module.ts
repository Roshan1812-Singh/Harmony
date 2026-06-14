import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';
import { TracksController } from './tracks.controller';
import { TracksService } from './tracks.service';
import { TranscodingProcessor } from './transcoding.processor';
import { SearchModule } from '../search/search.module';
import { TRANSCODE_QUEUE } from './tracks.tokens';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService<AppConfig, true>) => {
        const url = new URL(cfg.get('redis', { infer: true }).url);
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            password: url.password || undefined,
          },
        };
      },
    }),
    BullModule.registerQueue({ name: TRANSCODE_QUEUE }),
    SearchModule,
  ],
  controllers: [TracksController],
  providers: [TracksService, TranscodingProcessor],
  exports: [TracksService],
})
export class TracksModule {}
