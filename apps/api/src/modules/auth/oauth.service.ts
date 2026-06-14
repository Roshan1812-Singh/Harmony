import { BadRequestException, Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TokenService, type IssuedTokens } from './token.service';

export interface OAuthIdentity {
  provider: 'google' | 'github';
  providerSub: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
}

@Injectable()
export class OAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  /**
   * Idempotently links the OAuth identity to a user. Three branches:
   *   1. A user already has this provider sub recorded → log them in.
   *   2. Email matches an existing user → attach provider sub to that user.
   *   3. Else create a brand new account (password = NULL).
   */
  async linkOrCreate(identity: OAuthIdentity): Promise<{ user: User; tokens: IssuedTokens }> {
    if (!identity.email) {
      throw new BadRequestException('OAuth provider did not return an email');
    }

    const byProvider = await this.prisma.user.findFirst({
      where: {
        oauthProviders: {
          path: [identity.provider],
          equals: identity.providerSub,
        },
      },
    });
    if (byProvider) {
      return this.finish(byProvider);
    }

    const byEmail = await this.prisma.user.findUnique({ where: { email: identity.email } });
    if (byEmail) {
      const merged = {
        ...((byEmail.oauthProviders ?? {}) as Record<string, string>),
        [identity.provider]: identity.providerSub,
      };
      const updated = await this.prisma.user.update({
        where: { id: byEmail.id },
        data: {
          oauthProviders: merged,
          emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(),
          avatarUrl: byEmail.avatarUrl ?? identity.avatarUrl,
        },
      });
      return this.finish(updated);
    }

    const created = await this.prisma.user.create({
      data: {
        email: identity.email,
        displayName: identity.displayName,
        avatarUrl: identity.avatarUrl,
        emailVerifiedAt: new Date(), // OAuth email is considered verified
        oauthProviders: { [identity.provider]: identity.providerSub },
      },
    });
    return this.finish(created);
  }

  private async finish(user: User) {
    const tokens = await this.tokens.issueForUser({
      id: user.id,
      role: user.role,
      emailVerified: user.emailVerifiedAt !== null,
    });
    return { user, tokens };
  }
}
