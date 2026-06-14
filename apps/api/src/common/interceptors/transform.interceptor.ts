import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

/**
 * Lightweight passthrough. We intentionally do NOT wrap every response in `{ data: ... }`
 * because that breaks Swagger discoverability and forces clients to unwrap.
 * Pagination uses a documented `{ data, nextCursor }` shape returned by services directly.
 *
 * This interceptor remains for one specific purpose: serializing BigInt → string so JSON.stringify
 * doesn't throw on `Track.playCount`.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(_: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    return next.handle().pipe(map((value) => bigintSafe(value)));
  }
}

function bigintSafe(input: unknown): unknown {
  if (typeof input === 'bigint') return input.toString();
  if (input === null || input === undefined) return input;
  // Preserve Dates (and other non-plain objects) — recursing would turn `new Date()`
  // into `{}` because it has no enumerable own properties. JSON serialization then
  // emits the correct ISO string via Date.prototype.toJSON.
  if (input instanceof Date) return input;
  if (Array.isArray(input)) return input.map(bigintSafe);
  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = bigintSafe(v);
    }
    return out;
  }
  return input;
}
