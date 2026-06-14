import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import type { AppConfig } from '../../config/configuration';
import { S3Service } from './s3.service';
import { S3_CLIENT } from './s3.tokens';

@Global()
@Module({
  providers: [
    {
      provide: S3_CLIENT,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService<AppConfig, true>) => {
        const s = cfg.get('s3', { infer: true });
        return new S3Client({
          region: s.region,
          endpoint: s.endpoint ?? undefined,
          forcePathStyle: s.forcePathStyle,
          credentials: {
            accessKeyId: s.accessKeyId,
            secretAccessKey: s.secretAccessKey,
          },
        });
      },
    },
    S3Service,
  ],
  exports: [S3_CLIENT, S3Service],
})
export class S3Module {}
