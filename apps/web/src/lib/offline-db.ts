'use client';

import type { PlayerTrack } from '@/stores/player';

/**
 * Tiny IndexedDB wrapper for offline downloads. We persist the actual audio
 * bytes (a Blob fetched from our same-origin `/stream/:id/file` proxy) plus
 * enough metadata to render the track and rebuild a player queue without a
 * network connection.
 */
const DB_NAME = 'harmony-offline';
const STORE = 'tracks';
const VERSION = 1;

export interface OfflineMeta extends PlayerTrack {
  savedAt: number;
  size: number;
}

interface OfflineRecord {
  id: string;
  meta: OfflineMeta;
  blob: Blob;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const req = fn(transaction.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function idbSaveTrack(meta: OfflineMeta, blob: Blob): Promise<void> {
  await tx('readwrite', (s) => s.put({ id: meta.id, meta, blob } satisfies OfflineRecord));
}

export async function idbDeleteTrack(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}

export async function idbGetBlob(id: string): Promise<Blob | null> {
  const rec = await tx<OfflineRecord | undefined>('readonly', (s) => s.get(id));
  return rec?.blob ?? null;
}

export async function idbAllMeta(): Promise<OfflineMeta[]> {
  const recs = await tx<OfflineRecord[]>('readonly', (s) => s.getAll());
  return (recs ?? []).map((r) => r.meta).sort((a, b) => b.savedAt - a.savedAt);
}

export async function idbAllIds(): Promise<string[]> {
  try {
    const keys = await tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys());
    return (keys ?? []).map(String);
  } catch {
    return [];
  }
}
