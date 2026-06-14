'use client';

import { create } from 'zustand';
import type { PlayerTrack } from './player';
import { idbAllIds, idbDeleteTrack, idbSaveTrack, type OfflineMeta } from '@/lib/offline-db';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001/api/v1';

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

interface DownloadsState {
  ready: boolean;
  ids: Record<string, true>;
  /** trackId -> progress 0..1 while a download is in flight. */
  progress: Record<string, number>;
  init: () => Promise<void>;
  isDownloaded: (id: string) => boolean;
  download: (track: PlayerTrack) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useDownloads = create<DownloadsState>((set, get) => ({
  ready: false,
  ids: {},
  progress: {},

  init: async () => {
    if (get().ready) return;
    const ids = await idbAllIds();
    set({ ready: true, ids: Object.fromEntries(ids.map((id) => [id, true as const])) });
  },

  isDownloaded: (id) => !!get().ids[id],

  download: async (track) => {
    const { ids, progress } = get();
    if (ids[track.id] || progress[track.id] != null) return;
    set({ progress: { ...get().progress, [track.id]: 0 } });
    try {
      const res = await fetch(`${API_URL}/stream/${track.id}/file`, { credentials: 'include' });
      if (!res.ok || !res.body) throw new Error(`download failed: ${res.status}`);

      const total = Number(res.headers.get('content-length') ?? 0);
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.length;
          if (total > 0) {
            set({ progress: { ...get().progress, [track.id]: received / total } });
          }
        }
      }

      const type = res.headers.get('content-type') ?? 'audio/mp4';
      const blob = new Blob(chunks as BlobPart[], { type });

      // Cache the cover art as a data URL so the song shows its artwork fully
      // offline (no dependency on the remote CDN). Best-effort — never blocks.
      let coverUrl = track.coverUrl;
      try {
        const coverRes = await fetch(`${API_URL}/stream/${track.id}/cover`, { credentials: 'include' });
        if (coverRes.ok) coverUrl = await blobToDataUrl(await coverRes.blob());
      } catch {
        /* keep the remote cover URL */
      }

      const meta: OfflineMeta = { ...track, coverUrl, savedAt: Date.now(), size: blob.size };
      await idbSaveTrack(meta, blob);

      set((s) => {
        const nextProgress = { ...s.progress };
        delete nextProgress[track.id];
        return { ids: { ...s.ids, [track.id]: true }, progress: nextProgress };
      });
    } catch (err) {
      set((s) => {
        const nextProgress = { ...s.progress };
        delete nextProgress[track.id];
        return { progress: nextProgress };
      });
      // eslint-disable-next-line no-console
      console.error('download failed', err);
    }
  },

  remove: async (id) => {
    await idbDeleteTrack(id);
    set((s) => {
      const nextIds = { ...s.ids };
      delete nextIds[id];
      return { ids: nextIds };
    });
  },
}));
