import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import type { User } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MailerService } from '../../common/mailer/mailer.service';
import type { AppConfig } from '../../config/configuration';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { TokenService } from './token.service';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly mailer: MailerService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  onModuleInit(): void {
    // Wire the lazy user-loader expected by TokenService (avoids cyclic DI on PrismaService).
    this.tokens.bindUserLoader(async (id) => {
      const u = await this.prisma.user.findUnique({
        where: { id },
        select: { id: true, role: true, emailVerifiedAt: true, banned: true, deletedAt: true },
      });
      if (!u || u.banned || u.deletedAt) return null;
      return { id: u.id, role: u.role, emailVerified: u.emailVerifiedAt !== null };
    });
  }

  // ── Registration ────────────────────────────────────────────────────────
  async register(dto: RegisterDto): Promise<User> {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already registered');

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        displayName: dto.displayName,
      },
    });

    await this.sendEmailVerification(user);
    return user;
  }

  // ── Login ───────────────────────────────────────────────────────────────
  async login(dto: LoginDto): Promise<{ user: User; tokens: Awaited<ReturnType<TokenService['issueForUser']>> }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    // Constant-ish-time: always run argon2 verify even if user missing.
    const dummyHash =
      '$argon2id$v=19$m=65536,t=3,p=4$YWFhYWFhYWFhYWFhYWFhYQ$VKBlEzM/qH8mZ4kFNcaiC4u/o4dGPmDXvB1EJ0WaQys';
    const passOk = await argon2.verify(user?.passwordHash ?? dummyHash, dto.password).catch(() => false);
    if (!user || !user.passwordHash || !passOk) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.banned) throw new UnauthorizedException('Account suspended');
    if (user.deletedAt) throw new UnauthorizedException('Account deleted');

    const tokens = await this.tokens.issueForUser({
      id: user.id,
      role: user.role,
      emailVerified: user.emailVerifiedAt !== null,
    });
    return { user, tokens };
  }

  // ── Email verification ──────────────────────────────────────────────────
  async sendEmailVerification(user: User): Promise<void> {
    const { token, tokenHash } = generateOpaqueToken();
    await this.prisma.verificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        type: 'EMAIL_VERIFY',
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });
    const url = `${this.config.get('webOrigin', { infer: true })}/auth/verify-email?token=${token}`;
    await this.mailer.sendVerificationEmail(user.email, { displayName: user.displayName, url });
  }

  async verifyEmail(token: string): Promise<void> {
    const tokenHash = sha256(token);
    const record = await this.prisma.verificationToken.findUnique({ where: { tokenHash } });
    if (!record || record.type !== 'EMAIL_VERIFY' || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired token');
    }
    await this.prisma.$transaction([
      this.prisma.verificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
    ]);
  }

  // ── Forgot / reset password ─────────────────────────────────────────────
  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always return successfully; never disclose whether the email exists.
    if (!user) return;

    const { token, tokenHash } = generateOpaqueToken();
    await this.prisma.verificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        type: 'PASSWORD_RESET',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    const url = `${this.config.get('webOrigin', { infer: true })}/auth/reset-password?token=${token}`;
    await this.mailer.sendPasswordReset(user.email, { displayName: user.displayName, url });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = sha256(token);
    const record = await this.prisma.verificationToken.findUnique({ where: { tokenHash } });
    if (!record || record.type !== 'PASSWORD_RESET' || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired token');
    }
    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.verificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);
  }
}

function generateOpaqueToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: sha256(token) };
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
