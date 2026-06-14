import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type Profile } from 'passport-github2';
import type { AppConfig } from '../../../config/configuration';
import type { OAuthIdentity } from '../oauth.service';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(config: ConfigService<AppConfig, true>) {
    const github = config.get('oauth', { infer: true }).github;
    super({
      clientID: github.clientId || 'placeholder',
      clientSecret: github.clientSecret || 'placeholder',
      callbackURL: `/api/v1/auth/oauth/github/callback`,
      scope: ['user:email'],
    });
  }

  validate(_at: string, _rt: string, profile: Profile, done: (err: unknown, user?: OAuthIdentity) => void): void {
    const identity: OAuthIdentity = {
      provider: 'github',
      providerSub: profile.id,
      email: profile.emails?.[0]?.value ?? null,
      displayName: profile.displayName ?? profile.username ?? 'Listener',
      avatarUrl: profile.photos?.[0]?.value ?? null,
    };
    done(null, identity);
  }
}
