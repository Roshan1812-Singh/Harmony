import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import type { AppConfig } from './config/configuration';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(PinoLogger));

  const config = app.get(ConfigService<AppConfig, true>);

  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false, // CSP enforced at the web edge / Next.js
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(cookieParser());

  const corsOrigins = config.get('corsOrigins', { infer: true });
  app.enableCors({
    // Reflect any allow-listed origin (deployed frontend, LAN dev, WebView host).
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    exposedHeaders: ['X-CSRF-Token', 'Retry-After'],
  });

  app.setGlobalPrefix(config.get('globalPrefix', { infer: true }));

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  app.enableShutdownHooks();

  // OpenAPI / Swagger ------------------------------------------------------
  const swagger = new DocumentBuilder()
    .setTitle('Harmony API')
    .setDescription('Music streaming platform — REST API. See docs/API.md for conventions.')
    .setVersion('0.1.0')
    .addCookieAuth('harmony.at')
    .addBearerAuth()
    .addTag('auth')
    .addTag('users')
    .addTag('artists')
    .addTag('tracks')
    .addTag('albums')
    .addTag('playlists')
    .addTag('search')
    .addTag('streaming')
    .addTag('uploads')
    .addTag('admin')
    .addTag('health')
    .build();
  const document = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.get('port', { infer: true });
  await app.listen(port, '0.0.0.0');

  Logger.log(`🎵 Harmony API listening on http://localhost:${port}`, 'Bootstrap');
  Logger.log(`📘 Swagger at http://localhost:${port}/docs`, 'Bootstrap');
}

void bootstrap();
