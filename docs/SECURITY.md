# Harmony — Security

## Threat model summary

| Threat                        | Control                                                                  |
|-------------------------------|--------------------------------------------------------------------------|
| Credential stuffing            | bcrypt (cost 12) + rate limit + lockout + email alerts                  |
| Session hijack                 | httpOnly+Secure+SameSite cookies; refresh rotation; reuse detection      |
| XSS                            | React default-escaping + strict CSP + sanitize markdown                  |
| CSRF                           | SameSite=Lax + double-submit CSRF token on state-changing endpoints      |
| SQL injection                  | Prisma parameterised queries; no string concat                            |
| File upload abuse              | Pre-signed S3 PUT (typed + size capped) + MIME sniff + AV scan           |
| Hot-link / leech                | Short-lived signed CloudFront URLs (60min)                                |
| Mass scraping                  | Per-IP + per-user sliding-window rate limit (Redis)                      |
| Bot signups                    | Cloudflare Turnstile (or hCaptcha) on register/login                     |
| PII leak in logs               | `pino-redact` keys: `password`, `token`, `authorization`, `cookie`, `*.email` |
| Mass enumeration via email     | Constant-time response on `/auth/forgot-password`                         |
| Admin account compromise       | Required TOTP for `ADMIN` role; IP allowlist optional                    |

## Authentication

- **Access token**: JWT, RS256, 15-minute TTL. Public key on every API node; private key only on the auth node (could be KMS in production). Claims: `sub`, `role`, `email_verified`, `jti`, `iat`, `exp`.
- **Refresh token**: opaque random 256-bit, stored in Redis as `rt:{jti} → {userId, family, parentJti, createdAt}`, 30d TTL.
  - On every use we rotate: delete old, issue new with same `family`, link `parentJti`.
  - If a refresh token's `jti` is reused (already rotated), we delete the entire family — that's our theft signal.
- Both tokens delivered as cookies:
  - `harmony.at` — access, `httpOnly`, `Secure`, `SameSite=Lax`, path `/`.
  - `harmony.rt` — refresh, `httpOnly`, `Secure`, `SameSite=Strict`, path `/auth/refresh`.

## CSRF

- All `POST/PUT/PATCH/DELETE` endpoints require `x-csrf-token` header.
- On login we set a `harmony.csrf` cookie (NOT httpOnly) with a random token; client reads it and echoes in the header. Server compares both. Cookie is `SameSite=Lax` so cross-origin sites can't read it.

## Input validation

- Every controller method uses a DTO class with `class-validator` decorators.
- DTOs auto-generate OpenAPI schema via `@nestjs/swagger`.
- Frontend forms use the same Zod schemas from `@harmony/shared`, so both ends enforce identical rules.

## File uploads

1. Client `POST /uploads/audio/sign` — server returns pre-signed S3 PUT URL valid 5min, max-size 100 MB, content-type restricted to `audio/*`.
2. Client `PUT` to S3 directly (no upload bytes through API node).
3. Client `POST /tracks` with the resulting key.
4. Server enqueues a transcoding job which:
   - Downloads from S3.
   - Confirms magic bytes match (`ffprobe`).
   - Runs ClamAV (`clamdscan`).
   - On pass, transcodes and writes outputs; on fail, sets track `status=REJECTED`.

## Rate limiting

Sliding window via Redis. Defaults:

| Endpoint              | Limit         |
|-----------------------|---------------|
| `POST /auth/login`    | 5 / min / IP  |
| `POST /auth/register` | 3 / min / IP  |
| `POST /auth/forgot`   | 3 / hour / IP |
| Authenticated reads   | 600 / min / user |
| Authenticated writes  | 60 / min / user  |
| Anonymous reads       | 120 / min / IP  |

## HTTP hardening

- `helmet()` with strict CSP, HSTS (1y, includeSubdomains, preload), frameguard deny.
- `x-powered-by` removed.
- gzip / brotli at Nginx.
- TLS 1.2+ only.

## Secrets

- Local dev: `.env` files (git-ignored).
- Production: AWS Secrets Manager / SSM Parameter Store, mounted at boot. Never logged.
- JWT private key, OAuth client secrets, DB password, S3 keys, SMTP creds all in secrets manager.

## Audit log

`AuditLog` table records all admin actions (`USER_BAN`, `TRACK_TAKEDOWN`, etc.). Append-only via DB role permissions.

## Reporting

Security issues: security@harmony.example (PGP key in `/.well-known/security.txt`).
