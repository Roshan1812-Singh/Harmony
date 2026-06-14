import { TokenService } from './token.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import type { AppConfig } from '../../config/configuration';

interface RedisLite {
  store: Map<string, string>;
  get: jest.Mock;
  set: jest.Mock;
  del: jest.Mock;
  scan: jest.Mock;
}

function fakeRedis(): RedisLite {
  const store = new Map<string, string>();
  return {
    store,
    get: jest.fn(async (k: string) => store.get(k) ?? null),
    set: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
      return 'OK';
    }),
    del: jest.fn(async (k: string) => (store.delete(k) ? 1 : 0)),
    scan: jest.fn(async (cursor: string) => {
      const keys = Array.from(store.keys()).filter((k) => !k.startsWith('rt:tomb:'));
      return ['0', keys];
    }),
  };
}

describe('TokenService', () => {
  let service: TokenService;
  let jwt: JwtService;
  let redis: RedisLite;

  beforeEach(() => {
    redis = fakeRedis();
    jwt = new JwtService({
      secret: 'test-secret',
      signOptions: { expiresIn: '15m', issuer: 'harmony', algorithm: 'HS256' },
    });
    const cfg = {
      get: jest.fn((key: string) => {
        if (key === 'jwt') {
          return {
            accessPrivateKey: '',
            accessPublicKey: '',
            accessTtl: '15m',
            refreshTtl: '30d',
            issuer: 'harmony',
          };
        }
        return undefined;
      }),
    } as unknown as ConfigService<AppConfig, true>;

    service = new TokenService(jwt, cfg, redis as unknown as never);
    service.bindUserLoader(async (id) => ({
      id,
      role: 'USER',
      emailVerified: true,
    }));
  });

  it('issues a token pair', async () => {
    const pair = await service.issueForUser({ id: 'u1', role: 'USER', emailVerified: true });
    expect(pair.accessToken).toMatch(/\./);
    expect(pair.refreshToken).toHaveLength(64);
    expect(pair.csrfToken.length).toBeGreaterThan(20);
  });

  it('rotates a refresh token (deletes old, issues new)', async () => {
    const first = await service.issueForUser({ id: 'u1', role: 'USER', emailVerified: true });
    expect(redis.store.has(`rt:${first.refreshToken}`)).toBe(true);

    const second = await service.rotate(first.refreshToken);

    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(redis.store.has(`rt:${first.refreshToken}`)).toBe(false);
    expect(redis.store.has(`rt:${second.refreshToken}`)).toBe(true);
  });

  it('detects reuse and revokes the family', async () => {
    const first = await service.issueForUser({ id: 'u1', role: 'USER', emailVerified: true });
    const second = await service.rotate(first.refreshToken);
    // Replaying the old token should throw and (since the tombstone exists) revoke the family.
    await expect(service.rotate(first.refreshToken)).rejects.toThrow(UnauthorizedException);
    expect(redis.store.has(`rt:${second.refreshToken}`)).toBe(false);
  });

  it('rejects an unknown refresh token', async () => {
    await expect(service.rotate('nope')).rejects.toThrow(UnauthorizedException);
  });
});
