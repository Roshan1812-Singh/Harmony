import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';

/**
 * Deterministic HS256 secret for local dev (when no RS256 keys are configured).
 *
 * MUST be used by BOTH the signer (JwtModule) and the verifier (JwtStrategy) —
 * any divergence makes every access token fail verification, which silently logs
 * users out immediately after a successful login. Production sets RS256 keys and
 * never reaches this fallback.
 */
export function deriveDevSecret(cfg: ConfigService<AppConfig, true>): string {
  return `dev:${cfg.get('jwt', { infer: true }).issuer}:${cfg.get('database', { infer: true }).url.length}`;
}
