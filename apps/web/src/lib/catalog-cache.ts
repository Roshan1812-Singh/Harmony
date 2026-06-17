/**
 * Tiny localStorage-backed cache for catalog data (trending tracks, genres…).
 *
 * Goal: songs appear *immediately* when the app reopens. We persist the last
 * successful response and hand it to React Query as `initialData`, so the UI
 * renders instantly from disk while a fresh copy is fetched in the background
 * (important on a free-tier backend that may be waking from a cold start).
 */
const PREFIX = 'harmony:catalog:';

export function loadCache<T>(key: string): T | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

export function saveCache<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota / private mode — non-fatal */
  }
}
