import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import type { AppConfig } from '../../config/configuration';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { TokenService, type IssuedTokens } from './token.service';
import { OAuthService } from './oauth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto, VerifyEmailDto } from './dto/reset-password.dto';

const COOKIE_AT = 'harmony.at';
const COOKIE_RT = 'harmony.rt';
const COOKIE_CSRF = 'harmony.csrf';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
    private readonly oauth: OAuthService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Create an account; sends verification email.' })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.register(dto);
    const tokens = await this.tokens.issueForUser({
      id: user.id,
      role: user.role,
      emailVerified: user.emailVerifiedAt !== null,
    });
    this.setAuthCookies(res, tokens);
    return publicUser(user);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Email + password login.' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.auth.login(dto);
    this.setAuthCookies(res, tokens);
    return publicUser(user);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token; sets new auth cookies.' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rt = req.cookies?.[COOKIE_RT];
    if (!rt) throw new UnauthorizedException('No refresh token');
    const tokens = await this.tokens.rotate(rt);
    this.setAuthCookies(res, tokens);
    return { ok: true };
  }

  @Post('logout')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Revoke the current refresh-token family and clear cookies.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rt = req.cookies?.[COOKIE_RT];
    if (rt) await this.tokens.revoke(rt);
    this.clearAuthCookies(res);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 3_600_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Begin password reset; always returns 204 regardless of result.' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.token, dto.password);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.auth.verifyEmail(dto.token);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  async me(@CurrentUser() user: AuthUser) {
    return user;
  }

  // ── OAuth ──────────────────────────────────────────────────────────────
  @Public()
  @Get('oauth/google')
  @UseGuards(AuthGuard('google'))
  googleStart() {
    /* handled by guard redirect */
  }

  @Public()
  @Get('oauth/google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const profile = req.user as Parameters<OAuthService['linkOrCreate']>[0];
    const { user, tokens } = await this.oauth.linkOrCreate(profile);
    this.setAuthCookies(res, tokens);
    res.redirect(`${this.config.get('webOrigin', { infer: true })}/home?login=google`);
  }

  @Public()
  @Get('oauth/github')
  @UseGuards(AuthGuard('github'))
  githubStart() {}

  @Public()
  @Get('oauth/github/callback')
  @UseGuards(AuthGuard('github'))
  async githubCallback(@Req() req: Request, @Res() res: Response) {
    const profile = req.user as Parameters<OAuthService['linkOrCreate']>[0];
    const { user, tokens } = await this.oauth.linkOrCreate(profile);
    this.setAuthCookies(res, tokens);
    res.redirect(`${this.config.get('webOrigin', { infer: true })}/home?login=github`);
  }

  // ── Helpers ────────────────────────────────────────────────────────────
  /**
   * Resolve the cookie Domain attribute. `localhost` (and empty) must be sent as a
   * HOST-ONLY cookie — browsers (notably Chrome) reject an explicit
   * `Domain=localhost`, which silently dropped the session and bounced users back
   * to the login page. Only a real registrable domain is emitted.
   */
  private cookieDomain(): string | undefined {
    const { domain } = this.config.get('cookie', { infer: true });
    return domain && domain !== 'localhost' ? domain : undefined;
  }

  private setAuthCookies(res: Response, tokens: IssuedTokens) {
    const { secure, sameSite } = this.config.get('cookie', { infer: true });
    const domain = this.cookieDomain();
    // Cross-site (SameSite=None) cookies are only stored by browsers when Secure.
    const crossSite = sameSite === 'none';
    const effectiveSecure = secure || crossSite;
    // The refresh token can stay tighter (Strict) for same-site, but must relax
    // to None when the client lives on a different domain (deployed app / WebView).
    const rtSameSite = crossSite ? 'none' : 'strict';
    res.cookie(COOKIE_AT, tokens.accessToken, {
      httpOnly: true,
      secure: effectiveSecure,
      sameSite,
      ...(domain && { domain }),
      path: '/',
      maxAge: tokens.accessExpiresInSec * 1000,
    });
    res.cookie(COOKIE_RT, tokens.refreshToken, {
      httpOnly: true,
      secure: effectiveSecure,
      sameSite: rtSameSite,
      ...(domain && { domain }),
      path: '/api/v1/auth/refresh',
      maxAge: tokens.refreshExpiresInSec * 1000,
    });
    res.cookie(COOKIE_CSRF, tokens.csrfToken, {
      httpOnly: false, // readable by JS — double-submit pattern
      secure: effectiveSecure,
      sameSite,
      ...(domain && { domain }),
      path: '/',
      maxAge: tokens.accessExpiresInSec * 1000,
    });
  }

  private clearAuthCookies(res: Response) {
    const domain = this.cookieDomain();
    for (const name of [COOKIE_AT, COOKIE_RT, COOKIE_CSRF]) {
      res.clearCookie(name, {
        ...(domain && { domain }),
        path: name === COOKIE_RT ? '/api/v1/auth/refresh' : '/',
      });
    }
  }
}

function publicUser(u: { id: string; email: string; displayName: string; avatarUrl: string | null; role: string; emailVerifiedAt: Date | null; createdAt: Date }) {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    role: u.role,
    emailVerified: u.emailVerifiedAt !== null,
    createdAt: u.createdAt.toISOString(),
  };
}
