import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { PrismaService } from '../src/common/prisma/prisma.service';

/**
 * Full-stack e2e for the auth happy paths. Requires Postgres + Redis to be running.
 * Run with: pnpm --filter @harmony/api test:e2e
 */
describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: 'e2e+' } } });
    await app.close();
  });

  it('rejects weak passwords on register', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'e2e+weak@harmony.local', password: 'weak', displayName: 'E2E' });
    expect(res.status).toBe(400);
  });

  it('registers + logs in + refreshes', async () => {
    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'e2e+ok@harmony.local', password: 'P@ssw0rd!', displayName: 'E2E' });
    expect(reg.status).toBe(201);
    const cookies = reg.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('harmony.at='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('harmony.rt='))).toBe(true);

    const refresh = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookies.join('; '));
    expect(refresh.status).toBe(200);
  });

  it('returns 401 for /auth/me without cookies', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});
