'use client';

import { useEffect } from 'react';
import type { Route } from 'next';
import { Play } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { loadCache, saveCache } from '@/lib/catalog-cache';
import { playTracks, type PlayableLike } from '@/lib/play';
import { Section, CardGrid, MediaCard, GenreTile } from '@/components/media/cards';

interface ApiTrack extends PlayableLike {
  id: string;
  title: string;
  durationMs: number;
  coverUrl: string | null;
  artist: { id: string; displayName: string; slug: string };
  album?: { id: string; title: string; slug: string; coverUrl: string | null } | null;
}
interface TrackList {
  data: ApiTrack[];
  nextCursor: string | null;
}
interface Genre {
  id: string;
  name: string;
  slug: string;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomePage() {
  const { data: trending } = useQuery({
    queryKey: ['tracks', 'trending'],
    queryFn: () => api<TrackList>('/tracks/trending?limit=30'),
    // Render last-seen songs instantly from disk, then refetch in the background.
    initialData: () => loadCache<TrackList>('trending'),
    initialDataUpdatedAt: 0,
  });

  const { data: genres } = useQuery({
    queryKey: ['genres'],
    queryFn: () => api<Genre[]>('/genres'),
    initialData: () => loadCache<Genre[]>('genres'),
    initialDataUpdatedAt: 0,
  });

  useEffect(() => {
    if (trending) saveCache('trending', trending);
  }, [trending]);
  useEffect(() => {
    if (genres) saveCache('genres', genres);
  }, [genres]);

  const tracks = trending?.data ?? [];
  const shortcuts = tracks.slice(0, 8);
  const trendingCards = tracks.slice(0, 18);
  const loading = !trending;

  return (
    <div className="flex flex-col gap-10 pb-10">
      <section>
        <h1 className="text-3xl font-bold" suppressHydrationWarning>
          {greeting()}
        </h1>
      </section>

      {/* Quick-pick shortcut grid */}
      {shortcuts.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shortcuts.map((t, i) => (
            <button
              key={t.id}
              onClick={() => playTracks(shortcuts, i)}
              className="group flex items-center gap-4 overflow-hidden rounded-md bg-white/5 text-left transition-colors hover:bg-white/10"
            >
              <div className="size-16 shrink-0 overflow-hidden bg-[var(--color-surface-2)]">
                {t.coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.coverUrl} alt="" className="size-full object-cover" />
                )}
              </div>
              <span className="min-w-0 flex-1 truncate font-semibold">{t.title}</span>
              <span className="mr-3 grid size-12 shrink-0 translate-y-1 place-items-center rounded-full bg-[var(--color-accent)] text-black opacity-0 shadow-xl transition-all group-hover:translate-y-0 group-hover:opacity-100">
                <Play size={20} fill="currentColor" className="ml-0.5" />
              </span>
            </button>
          ))}
        </div>
      )}

      {/* First-ever load (no cache yet): show lightweight skeletons so the screen
          never looks empty while the backend wakes up. */}
      {loading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 rounded-md bg-white/5">
              <div className="size-16 shrink-0 animate-pulse bg-[var(--color-surface-2)]" />
              <div className="h-4 w-32 animate-pulse rounded bg-[var(--color-surface-2)]" />
            </div>
          ))}
        </div>
      )}

      {trendingCards.length > 0 && (
        <Section title="Trending now">
          <CardGrid>
            {trendingCards.map((t, i) => (
              <MediaCard
                key={t.id}
                coverUrl={t.coverUrl}
                title={t.title}
                subtitle={t.artist?.displayName}
                onPlay={() => playTracks(trendingCards, i)}
              />
            ))}
          </CardGrid>
        </Section>
      )}

      {genres && genres.length > 0 && (
        <Section title="Browse by genre">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {genres.slice(0, 15).map((g) => (
              <GenreTile key={g.id} name={g.name} href={`/genre/${g.id}` as Route} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
