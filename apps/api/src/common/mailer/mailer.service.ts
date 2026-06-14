import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type { AppConfig } from '../../config/configuration';

interface EmailVerificationContext {
  displayName: string;
  url: string;
}

interface PasswordResetContext {
  displayName: string;
  url: string;
}

/**
 * SMTP mailer. In dev we point at Mailhog (no auth, port 1025). In prod use SES / Resend
 * by setting SMTP_* env vars. Failures are logged but do not throw — we never want
 * email deliverability to block a signup/refresh code path.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    const mail = config.get('mail', { infer: true });
    this.from = mail.from;
    this.transporter = nodemailer.createTransport({
      host: mail.host,
      port: mail.port,
      secure: mail.port === 465,
      auth: mail.user && mail.pass ? { user: mail.user, pass: mail.pass } : undefined,
    });
  }

  async sendVerificationEmail(to: string, ctx: EmailVerificationContext): Promise<void> {
    await this.safeSend({
      to,
      subject: 'Verify your Harmony email',
      text: `Hi ${ctx.displayName},\n\nConfirm your email by clicking: ${ctx.url}\n\nThis link expires in 24 hours.`,
      html: htmlButton('Verify email', ctx.url, `Hi ${ctx.displayName}, confirm your email:`),
    });
  }

  async sendPasswordReset(to: string, ctx: PasswordResetContext): Promise<void> {
    await this.safeSend({
      to,
      subject: 'Reset your Harmony password',
      text: `Hi ${ctx.displayName},\n\nReset your password: ${ctx.url}\n\nIf you didn't request this, ignore this email.`,
      html: htmlButton(
        'Reset password',
        ctx.url,
        `Hi ${ctx.displayName}, click below to reset your password.`,
      ),
    });
  }

  private async safeSend(opts: { to: string; subject: string; text: string; html: string }) {
    try {
      await this.transporter.sendMail({ from: this.from, ...opts });
    } catch (err) {
      this.logger.error(`mailer failed for ${opts.to}: ${(err as Error).message}`);
    }
  }
}

function htmlButton(label: string, href: string, intro: string): string {
  return `
  <!doctype html><html><body style="font-family:Inter,Arial,sans-serif;background:#0b0b0d;color:#fff;padding:32px">
    <h1 style="font-size:20px">${escape('Harmony')}</h1>
    <p>${escape(intro)}</p>
    <p><a style="display:inline-block;background:#1db954;color:#fff;padding:12px 18px;border-radius:999px;text-decoration:none" href="${escape(href)}">${escape(label)}</a></p>
    <p style="color:#888;font-size:12px">If the button doesn't work, paste this URL into your browser:<br>${escape(href)}</p>
  </body></html>`;
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
