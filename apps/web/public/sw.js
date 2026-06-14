/* Harmony service worker — app-shell + static asset caching for offline use.
 * Audio for offline playback is handled separately in IndexedDB by the player;
 * this SW only makes the app itself open and navigate without a connection.
 * It intentionally never caches API responses (different origin) or media. */

const VERSION = 'v1';
const SHELL_CACHE = `harmony-shell-${VERSION}`;
const ASSET_CACHE = `harmony-assets-${VERSION}`;
const PRECACHE = ['/home', '/icon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(PRECACHE)).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => ![SHELL_CACHE, ASSET_CACHE].includes(k)).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Only handle same-origin requests; let API (other port) and CDN media pass through.
  if (url.origin !== self.location.origin) return;

  // App navigations: network-first, fall back to cached page or the home shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(SHELL_CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          const cached = (await caches.match(req)) || (await caches.match('/home'));
          return (
            cached ||
            new Response('<h1>Offline</h1><p>Reconnect to load new pages. Your downloads are still available.</p>', {
              headers: { 'Content-Type': 'text/html' },
            })
          );
        }
      })(),
    );
    return;
  }

  // Build assets & icons: stale-while-revalidate.
  if (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/_next/image') || PRECACHE.includes(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })(),
    );
  }
});
