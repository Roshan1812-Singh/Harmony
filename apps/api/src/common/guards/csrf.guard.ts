import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_HEADER = 'x-csrf-token';
const CSRF_COOKIE = 'harmony.csrf';

/**
 * Double-submit CSRF check.
 *
 *   – Safe methods bypass.
 *   – Otherwise the request must echo the `harmony.csrf` cookie value in the
 *     `x-csrf-token` header. Because the cookie is readable JS-side (SameSite=Lax),
 *     a cross-origin attacker cannot copy it into a header.
 *
 * The cookie is issued/rotated by AuthService on login/refresh.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;

    const cookie = req.cookies?.[CSRF_COOKIE];
    const header = req.headers[CSRF_HEADER];
    if (!cookie || !header || cookie !== header) {
      throw new ForbiddenException('Invalid CSRF token');
    }
    return true;
  }
}
