import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type { AppConfig } from '../../../config/configuration';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../token.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { deriveDevSecret } from '../dev-secret';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly prisma: PrismaService,
  ) {
    const jwt = config.get('jwt', { infer: true });
    // HS256 dev secret must match the JwtModule signer (see deriveDevSecret).
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.['harmony.at'] ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: jwt.accessPublicKey || deriveDevSecret(config),
      algorithms: [jwt.accessPublicKey ? 'RS256' : 'HS256'],
      issuer: jwt.issuer,
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, emailVerifiedAt: true, banned: true, deletedAt: true },
    });
    if (!user || user.banned || user.deletedAt) {
      throw new UnauthorizedException('Token subject invalid');
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerifiedAt !== null,
    };
  }
}
