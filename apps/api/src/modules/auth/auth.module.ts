import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { AppConfig } from '../../config/configuration';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { OAuthService } from './oauth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { GithubStrategy } from './strategies/github.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { deriveDevSecret } from './dev-secret';

@Module({
  imports: [
    PassportModule.register({ session: false }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService<AppConfig, true>): JwtModuleOptions => {
        const jwt = cfg.get('jwt', { infer: true });
        return {
          privateKey: jwt.accessPrivateKey || undefined,
          publicKey: jwt.accessPublicKey || undefined,
          signOptions: {
            algorithm: jwt.accessPrivateKey ? 'RS256' : 'HS256',
            expiresIn: jwt.accessTtl,
            issuer: jwt.issuer,
          },
          // Fallback: if no RS256 keys, derive an HS256 secret from issuer + DATABASE_URL.
          // Suitable only for dev; production MUST set RS256 keys.
          ...(!jwt.accessPrivateKey && {
            secret: deriveDevSecret(cfg),
          }),
        } as JwtModuleOptions;
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    OAuthService,
    JwtStrategy,
    GoogleStrategy,
    GithubStrategy,
    JwtAuthGuard,
  ],
  exports: [AuthService, TokenService, JwtAuthGuard, JwtModule],
})
export class AuthModule {}
