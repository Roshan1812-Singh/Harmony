'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { PublicTrack } from '@harmony/shared';

export interface PlayerTrack extends Pick<PublicTrack, 'id' | 'title' | 'durationMs' | 'artistId'> {
  artistName: string;
  artistSlug?: string;
  albumTitle?: string;
  albumSlug?: string;
  coverUrl: string | null;
}

interface PlayerState {
  queue: PlayerTrack[];
  index: number;
  isPlaying: boolean;
  positionMs: number;
  /** A pending seek (ms) the <audio> element should apply, then clear. Null when idle. */
  seekRequestMs: number | null;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: 'off' | 'one' | 'all';

  setQueue: (queue: PlayerTrack[], startIndex?: number) => void;
  enqueue: (track: PlayerTrack) => void;
  enqueueMany: (tracks: PlayerTrack[]) => void;
  playNext: (track: PlayerTrack) => void;
  jumpTo: (index: number) => void;
  removeAt: (index: number) => void;
  clearSeekRequest: () => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (ms: number) => void;
  setPosition: (ms: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  clear: () => void;
}

export const usePlayer = create<PlayerState>()(
  persist(
    (set, get) => ({
      queue: [],
      index: -1,
      isPlaying: false,
      positionMs: 0,
      seekRequestMs: null,
      volume: 0.85,
      muted: false,
      shuffle: false,
      repeat: 'off',

      setQueue: (queue, startIndex = 0) =>
        set({
          queue,
          index: queue.length ? Math.min(Math.max(0, startIndex), queue.length - 1) : -1,
          positionMs: 0,
          isPlaying: queue.length > 0,
        }),

      enqueue: (t) => set({ queue: [...get().queue, t] }),
      enqueueMany: (ts) => set({ queue: [...get().queue, ...ts] }),

      playNext: (t) => {
        const { queue, index } = get();
        const insertAt = Math.min(index + 1, queue.length);
        const next = [...queue.slice(0, insertAt), t, ...queue.slice(insertAt)];
        set({ queue: next });
      },

      jumpTo: (i) => {
        const { queue } = get();
        if (i < 0 || i >= queue.length) return;
        set({ index: i, positionMs: 0, isPlaying: true });
      },

      clearSeekRequest: () => set({ seekRequestMs: null }),

      removeAt: (i) => {
        const { queue, index } = get();
        if (i < 0 || i >= queue.length) return;
        const next = queue.filter((_, idx) => idx !== i);
        const newIndex = i < index ? index - 1 : Math.min(index, next.length - 1);
        set({ queue: next, index: newIndex, isPlaying: next.length > 0 && get().isPlaying });
      },

      play: () => set({ isPlaying: true }),
      pause: () => set({ isPlaying: false }),
      toggle: () => set({ isPlaying: !get().isPlaying }),

      next: () => {
        const { queue, index, repeat, shuffle } = get();
        if (!queue.length) return;
        if (repeat === 'one') return set({ positionMs: 0, isPlaying: true });
        let nextIndex: number;
        if (shuffle) {
          nextIndex = Math.floor(Math.random() * queue.length);
        } else {
          nextIndex = index + 1;
          if (nextIndex >= queue.length) {
            if (repeat === 'all') nextIndex = 0;
            else return set({ isPlaying: false });
          }
        }
        set({ index: nextIndex, positionMs: 0, isPlaying: true });
      },

      prev: () => {
        const { index, positionMs, queue } = get();
        if (positionMs > 3_000) {
          return set({ positionMs: 0 });
        }
        const previous = Math.max(0, index - 1);
        set({ index: previous, positionMs: 0, isPlaying: queue.length > 0 });
      },

      seek: (ms) => set({ positionMs: Math.max(0, ms), seekRequestMs: Math.max(0, ms) }),
      setPosition: (ms) => set({ positionMs: ms }),
      setVolume: (v) => set({ volume: Math.min(1, Math.max(0, v)), muted: false }),
      toggleMute: () => set({ muted: !get().muted }),
      toggleShuffle: () => set({ shuffle: !get().shuffle }),
      cycleRepeat: () =>
        set({
          repeat: get().repeat === 'off' ? 'all' : get().repeat === 'all' ? 'one' : 'off',
        }),

      clear: () => set({ queue: [], index: -1, isPlaying: false, positionMs: 0 }),
    }),
    {
      name: 'harmony.player',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        queue: s.queue,
        index: s.index,
        volume: s.volume,
        muted: s.muted,
        shuffle: s.shuffle,
        repeat: s.repeat,
      }),
    },
  ),
);

export const currentTrack = (s: PlayerState): PlayerTrack | null =>
  s.index >= 0 && s.index < s.queue.length ? (s.queue[s.index] ?? null) : null;
