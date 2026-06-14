'use client';

import { use, useEffect, useRef } from 'react';
import { Play } from 'lucide-react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { playTracks } from '@/lib/play';
import { TrackRow, type TrackRowItem } from '@/components/track/track-row';

interface TrackList {
  data: TrackRowItem[];
  nextCursor: string | null;
}
interface Genre {
  id: string;
  name: string;
  slug: string;
}

const PAGE = 50;

export default function GenrePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: genres } = useQuery({
    queryKey: ['genres'],
    queryFn: () => api<Genre[]>('/genres'),
  });
  const genre = genres?.find((g) => g.id === id);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['tracks', 'genre', id],
    queryFn: ({ pageParam }) =>
      api<TrackList>(
        `/tracks?genreId=${id}&limit=${PAGE}${pageParam ? `&cursor=${pageParam}` : ''}`,
      ),
    initialPageParam: '' as string,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const tracks = data?.pages.flatMap((p) => p.data) ?? [];

  // Auto-load the next page when the sentinel scrolls into view.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: '600px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header
        className="-mx-4 sm:-mx-6 flex items-end gap-6 rounded-b-xl px-4 sm:px-6 py-14"
        style={{ background: 'linear-gradient(135deg, #7358ff, var(--color-bg))' }}
      >
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide">Genre</p>
          <h1 className="text-5xl font-bold sm:text-7xl">{genre?.name ?? 'Loading…'}</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            {tracks.length}
            {hasNextPage ? '+' : ''} songs
          </p>
        </div>
      </header>

      {tracks.length > 0 && (
        <div className="flex items-center gap-4">
          <button
            aria-label="Play all"
            onClick={() => playTracks(tracks, 0)}
            className="grid size-14 place-items-center rounded-full bg-[var(--color-accent)] text-black shadow-xl transition hover:scale-105"
          >
            <Play size={26} fill="currentColor" className="ml-1" />
          </button>
        </div>
      )}

      <div className="flex flex-col">
        {tracks.map((t, i) => (
          <TrackRow key={`${t.id}-${i}`} track={t} index={i} context={tracks} />
        ))}
        {data && tracks.length === 0 && (
          <p className="text-[var(--color-text-muted)]">No songs in this genre yet.</p>
        )}
      </div>

      <div ref={sentinelRef} className="h-10" />
      {isFetchingNextPage && (
        <p className="text-center text-sm text-[var(--color-text-muted)]">Loading more…</p>
      )}
    </div>
  );
}
