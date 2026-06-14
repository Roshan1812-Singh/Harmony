import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type Profile, type VerifyCallback } from 'passport-google-oauth20';
import type { AppConfig } from '../../../config/configuration';
import type { OAuthIdentity } from '../oauth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService<AppConfig, true>) {
    const google = config.get('oauth', { infer: true }).google;
    super({
      clientID: google.clientId || 'placeholder',
      clientSecret: google.clientSecret || 'placeholder',
      callbackURL: `/api/v1/auth/oauth/google/callback`,
      scope: ['email', 'profile'],
    });
  }

  validate(_at: string, _rt: string, profile: Profile, done: VerifyCallback): void {
    const identity: OAuthIdentity = {
      provider: 'google',
      providerSub: profile.id,
      email: profile.emails?.[0]?.value ?? null,
      displayName: profile.displayName ?? profile.username ?? 'Listener',
      avatarUrl: profile.photos?.[0]?.value ?? null,
    };
    done(null, identity);
  }
}
