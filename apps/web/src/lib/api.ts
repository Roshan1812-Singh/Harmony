/**
 * Tiny typed fetch client.
 *
 *  – Always includes credentials so cookies (`harmony.at`, `harmony.rt`, `harmony.csrf`) flow.
 *  – Reads the CSRF cookie on mutations and echoes it via `x-csrf-token`.
 *  – On 401 we attempt a one-shot refresh and retry the original request.
 *  – Throws a typed `ApiError` so React components can render rich problem detail.
 */
import type { ApiError } from '@harmony/shared';
import { API_URL } from './api-url';

const CSRF_COOKIE = 'harmony.csrf';

export class HarmonyApiError extends Error {
  constructor(public readonly status: number, public readonly problem: ApiError) {
    super(problem.title);
  }
}

interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  retryOn401?: boolean;
}

export async function api<T = unknown>(path: string, opts: FetchOptions = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_URL}${path}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }

  const method = (opts.method ?? 'GET').toUpperCase();
  const headers = new Headers(opts.headers);

  if (opts.body !== undefined && !(opts.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = readCookie(CSRF_COOKIE);
    if (csrf) headers.set('x-csrf-token', csrf);
  }

  const res = await fetch(url.toString(), {
    ...opts,
    method,
    credentials: 'include',
    headers,
    body:
      opts.body === undefined
        ? undefined
        : opts.body instanceof FormData
          ? opts.body
          : JSON.stringify(opts.body),
  });

  if (res.status === 401 && opts.retryOn401 !== false && !path.startsWith('/auth/')) {
    const refreshed = await refresh();
    if (refreshed) {
      return api<T>(path, { ...opts, retryOn401: false });
    }
  }

  if (res.status === 204) return undefined as T;

  const ct = res.headers.get('content-type') ?? '';
  const body = ct.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const problem: ApiError =
      typeof body === 'object' && body !== null
        ? (body as ApiError)
        : { type: 'about:blank', title: res.statusText, status: res.status, detail: String(body) };
    throw new HarmonyApiError(res.status, problem);
  }
  return body as T;
}

let refreshInFlight: Promise<boolean> | null = null;
async function refresh(): Promise<boolean> {
  refreshInFlight ??= fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  return (
    document.cookie
      .split('; ')
      .map((c) => c.split('='))
      .find(([k]) => k === name)?.[1] ?? null
  );
}
