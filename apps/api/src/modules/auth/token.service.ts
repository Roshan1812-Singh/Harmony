import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import type Redis from 'ioredis';
import type { UserRole } from '@prisma/client';
import type { AppConfig } from '../../config/configuration';
import { REDIS_CLIENT } from '../../common/redis/redis.module';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  email_verified: boolean;
  jti: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  accessExpiresInSec: number;
  refreshExpiresInSec: number;
}

interface RefreshRecord {
  userId: string;
  family: string;
  parentJti: string | null;
  createdAt: number;
}

/**
 * Stateless access tokens (JWT) + opaque, rotating refresh tokens stored in Redis.
 *
 * Refresh rotation rules:
 *   1. On every successful refresh, the old refresh token is *deleted* and a new one issued
 *      in the same `family`.
 *   2. If a request arrives with a refresh `jti` that no longer exists but the family does,
 *      we treat that as token theft and revoke the entire family.
 */
@Injectable()
export class TokenService {
  private readonly refreshTtlSec: number;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.refreshTtlSec = parseDurationToSec(this.config.get('jwt', { infer: true }).refreshTtl);
  }

  async issueForUser(user: { id: string; role: UserRole; emailVerified: boolean }): Promise<IssuedTokens> {
    const family = uuidv4();
    return this.mintPair(user, family, null);
  }

  /**
   * Rotates a refresh token. Returns a brand-new pair. Throws 401 if the supplied
   * token is invalid, expired, or part of a revoked family (theft detection).
   */
  async rotate(refreshToken: string): Promise<IssuedTokens> {
    const jti = refreshToken;
    const raw = await this.redis.get(refreshKey(jti));
    if (!raw) {
      // Maybe this is a *reused* (already-rotated) token. Check by family map.
      // We store a secondary key `rt:family:{family}` only on rotation. Reuse of any old
      // jti is impossible to detect cheaply without storing per-jti, so reuse detection
      // happens when the *family* still exists but the jti doesn't. We can't recover the
      // family without the jti record — so we simply fail. To make reuse detection
      // tractable we also keep a secondary `rt:jti:{jti}` for 5 minutes after rotation:
      const tomb = await this.redis.get(tombstoneKey(jti));
      if (tomb) {
        await this.revokeFamily(tomb);
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
    const record = JSON.parse(raw) as RefreshRecord;

    // Look up role/verified state fresh (in case the role changed).
    const user = await this.loadUserState(record.userId);
    if (!user) throw new UnauthorizedException('User no longer exists');

    // Delete the consumed token, drop a short-lived tombstone (for reuse detection),
    // then mint the new pair.
    await this.redis.del(refreshKey(jti));
    await this.redis.set(tombstoneKey(jti), record.family, 'EX', 300);

    return this.mintPair(user, record.family, jti);
  }

  async revoke(refreshToken: string): Promise<void> {
    const raw = await this.redis.get(refreshKey(refreshToken));
    if (!raw) return;
    const record = JSON.parse(raw) as RefreshRecord;
    await this.revokeFamily(record.family);
  }

  async revokeFamily(family: string): Promise<void> {
    // Best-effort: scan and delete any tokens still belonging to the family.
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.scan(cursor, 'MATCH', 'rt:*', 'COUNT', 200);
      cursor = next;
      for (const key of keys) {
        if (key.startsWith('rt:tomb:')) continue;
        const raw = await this.redis.get(key);
        if (!raw) continue;
        const rec = JSON.parse(raw) as RefreshRecord;
        if (rec.family === family) await this.redis.del(key);
      }
    } while (cursor !== '0');
  }

  verifyAccess(token: string): AccessTokenPayload {
    try {
      return this.jwt.verify<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  private async mintPair(
    user: { id: string; role: UserRole; emailVerified: boolean },
    family: string,
    parentJti: string | null,
  ): Promise<IssuedTokens> {
    const accessJti = uuidv4();
    const payload: AccessTokenPayload = {
      sub: user.id,
      role: user.role,
      email_verified: user.emailVerified,
      jti: accessJti,
    };
    const accessToken = await this.jwt.signAsync(payload);
    const accessExpiresInSec = parseDurationToSec(
      this.config.get('jwt', { infer: true }).accessTtl,
    );

    const refreshToken = randomBytes(48).toString('base64url');
    const record: RefreshRecord = {
      userId: user.id,
      family,
      parentJti,
      createdAt: Date.now(),
    };
    await this.redis.set(
      refreshKey(refreshToken),
      JSON.stringify(record),
      'EX',
      this.refreshTtlSec,
    );

    const csrfToken = randomBytes(32).toString('base64url');

    return {
      accessToken,
      refreshToken,
      csrfToken,
      accessExpiresInSec,
      refreshExpiresInSec: this.refreshTtlSec,
    };
  }

  /**
   * We need to look up the user's current role/verified state at refresh time.
   * Injecting PrismaService here would create a cycle (auth ↔ users), so we read
   * the bare minimum directly through a small SQL query via the existing JwtService's
   * `getOptions` is not possible — instead users module fetches and passes us this fn.
   * For simplicity, we'll query via a lazy Prisma instance attached at module init.
   */
  private loadUserState!: (id: string) => Promise<{
    id: string;
    role: UserRole;
    emailVerified: boolean;
  } | null>;

  /** Injected by AuthService at startup. */
  bindUserLoader(loader: typeof this.loadUserState): void {
    this.loadUserState = loader;
  }
}

function refreshKey(jti: string): string {
  return `rt:${jti}`;
}

function tombstoneKey(jti: string): string {
  return `rt:tomb:${jti}`;
}

function parseDurationToSec(input: string): number {
  // Accepts "15m", "30d", "1h", "3600s", or raw seconds.
  const m = /^(\d+)(s|m|h|d)?$/.exec(input.trim());
  if (!m) throw new Error(`Invalid duration: ${input}`);
  const n = Number(m[1]);
  switch (m[2]) {
    case 's':
    case undefined:
      return n;
    case 'm':
      return n * 60;
    case 'h':
      return n * 3600;
    case 'd':
      return n * 86400;
    default:
      return n;
  }
}
