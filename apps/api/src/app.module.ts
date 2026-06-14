import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { configuration, type AppConfig } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { S3Module } from './common/s3/s3.module';
import { MailerModule } from './common/mailer/mailer.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ArtistsModule } from './modules/artists/artists.module';
import { AlbumsModule } from './modules/albums/albums.module';
import { TracksModule } from './modules/tracks/tracks.module';
import { GenresModule } from './modules/genres/genres.module';
import { PlaylistsModule } from './modules/playlists/playlists.module';
import { LikesModule } from './modules/likes/likes.module';
import { LibraryModule } from './modules/library/library.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { StreamingModule } from './modules/streaming/streaming.module';
import { SearchModule } from './modules/search/search.module';
import { AdminModule } from './modules/admin/admin.module';
import { HealthModule } from './modules/health/health.module';
import { MetricsModule } from './common/metrics/metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
      cache: true,
    }),

    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService<AppConfig, true>) => ({
        pinoHttp: {
          level: cfg.get('logLevel', { infer: true }),
          transport:
            cfg.get('nodeEnv', { infer: true }) === 'production'
              ? undefined
              : { target: 'pino-pretty', options: { singleLine: true } },
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'res.headers["set-cookie"]',
              '*.password',
              '*.passwordHash',
              '*.token',
              '*.refreshToken',
            ],
            remove: true,
          },
          customProps: () => ({ service: 'harmony-api' }),
          serializers: {
            req: (req) => ({
              id: req.id,
              method: req.method,
              url: req.url,
              remoteAddress: req.remoteAddress,
            }),
          },
        },
      }),
    }),

    EventEmitterModule.forRoot({ wildcard: true, maxListeners: 50 }),

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService<AppConfig, true>) => [
        {
          ttl: cfg.get('throttleTtlMs', { infer: true }),
          limit: cfg.get('throttleLimit', { infer: true }),
        },
      ],
    }),

    PrismaModule,
    RedisModule,
    S3Module,
    MailerModule,
    MetricsModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ArtistsModule,
    AlbumsModule,
    TracksModule,
    GenresModule,
    PlaylistsModule,
    LikesModule,
    LibraryModule,
    UploadsModule,
    StreamingModule,
    SearchModule,
    AdminModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
