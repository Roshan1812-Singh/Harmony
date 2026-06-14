'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker for offline app-shell support and PWA install.
 * Only active in production builds — running a SW in `next dev` would cache
 * Turbopack's hashed chunks and break hot reloading.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    };
    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);

  return null;
}
