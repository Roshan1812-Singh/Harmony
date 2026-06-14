'use client';

import Link from 'next/link';
import { Play, Heart } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useCurrentUser } from '@/hooks/use-auth';
import { playTracks } from '@/lib/play';
import { TrackRow, type TrackRowItem } from '@/components/track/track-row';
import { formatDuration } from '@/lib/utils';

interface LikedResponse {
  data: TrackRowItem[];
  nextCursor: string | null;
}

export default function LikedSongsPage() {
  const { data: user } = useCurrentUser();

  const { data } = useQuery({
    enabled: !!user,
    queryKey: ['library', 'liked'],
    queryFn: () => api<LikedResponse>('/library/liked?limit=100'),
  });

  if (!user) {
    return (
      <p className="p-6 text-[var(--color-text-muted)]">
        <Link href="/auth/login" className="text-[var(--color-accent)] underline">Sign in</Link> to see your Liked Songs.
      </p>
    );
  }

  const tracks = data?.data ?? [];
  const totalMs = tracks.reduce((s, t) => s + t.durationMs, 0);

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header
        className="-mx-4 sm:-mx-6 flex items-end gap-6 px-4 sm:px-6 pt-10 pb-8"
        style={{ background: 'linear-gradient(135deg, #4c1d95 0%, #5b21b6 40%, var(--color-bg) 100%)' }}
      >
        <div className="grid size-40 sm:size-52 place-items-center rounded-lg bg-gradient-to-br from-indigo-400 to-purple-700 shadow-2xl">
          <Heart size={72} className="fill-white text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide">Playlist</p>
          <h1 className="text-5xl font-bold sm:text-7xl">Liked Songs</h1>
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">
            {user.displayName} · {tracks.length} songs · {formatDuration(totalMs)}
          </p>
        </div>
      </header>

      {tracks.length > 0 ? (
        <>
          <button
            aria-label="Play liked songs"
            onClick={() => playTracks(tracks, 0)}
            className="grid size-14 place-items-center rounded-full bg-[var(--color-accent)] text-black shadow-xl transition hover:scale-105"
          >
            <Play size={26} fill="currentColor" className="ml-1" />
          </button>
          <div className="flex flex-col rounded-lg bg-[var(--color-surface)] p-2">
            {tracks.map((t, i) => (
              <TrackRow key={t.id} track={t} index={i} context={tracks} liked />
            ))}
          </div>
        </>
      ) : (
        <p className="text-[var(--color-text-muted)]">
          Songs you like will appear here. Tap the heart on any song.
        </p>
      )}
    </div>
  );
}
