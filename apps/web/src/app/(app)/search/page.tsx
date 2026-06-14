'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Search as SearchIcon, Play, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { playTracks } from '@/lib/play';
import { Section, CardGrid, MediaCard, GenreTile } from '@/components/media/cards';
import { TrackRow, type TrackRowItem } from '@/components/track/track-row';

interface SearchHit {
  type: 'track' | 'album' | 'artist';
  id: string;
  title: string;
  subtitle?: string;
  slug?: string;
  coverUrl: string | null;
  score: number;
  durationMs?: number;
  artistId?: string;
  artistName?: string;
  artistSlug?: string;
  albumId?: string;
  albumTitle?: string;
}
interface Genre {
  id: string;
  name: string;
  slug: string;
}

type Tab = 'all' | 'track' | 'artist' | 'album';
const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'track', label: 'Songs' },
  { id: 'artist', label: 'Artists' },
  { id: 'album', label: 'Albums' },
];

function toRow(t: SearchHit): TrackRowItem {
  return {
    id: t.id,
    title: t.title,
    durationMs: t.durationMs ?? 0,
    artistId: t.artistId ?? '',
    artistName: t.artistName ?? t.subtitle ?? '',
    artistSlug: t.artistSlug,
    albumTitle: t.albumTitle,
    coverUrl: t.coverUrl,
    artist: { id: t.artistId ?? '', displayName: t.artistName ?? t.subtitle ?? '', slug: t.artistSlug ?? '' },
    album: t.albumId ? { id: t.albumId, title: t.albumTitle ?? '', slug: '', coverUrl: t.coverUrl } : null,
  };
}

export default function SearchPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [tab, setTab] = useState<Tab>('all');

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 180);
    return () => clearTimeout(id);
  }, [q]);

  const { data: genres } = useQuery({
    queryKey: ['genres'],
    queryFn: () => api<Genre[]>('/genres'),
  });

  const { data, isFetching } = useQuery({
    enabled: debounced.length > 0,
    queryKey: ['search', debounced],
    queryFn: () => api<SearchHit[]>(`/search?q=${encodeURIComponent(debounced)}`),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const tracks = useMemo(() => (data ?? []).filter((d) => d.type === 'track'), [data]);
  const albums = useMemo(() => (data ?? []).filter((d) => d.type === 'album'), [data]);
  const artists = useMemo(() => (data ?? []).filter((d) => d.type === 'artist'), [data]);
  const rows = useMemo(() => tracks.map(toRow), [tracks]);
  const top = useMemo(() => (data && data.length ? [...data].sort((a, b) => b.score - a.score)[0] : null), [data]);

  function activateHit(h: SearchHit) {
    if (h.type === 'track') {
      const i = tracks.findIndex((t) => t.id === h.id);
      playTracks(rows, Math.max(0, i));
    } else if (h.type === 'artist' && h.slug) {
      router.push(`/artist/${h.slug}`);
    } else if (h.type === 'album') {
      router.push(`/album/${h.id}`);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="sticky top-0 z-10 -mx-4 bg-[var(--color-bg)]/80 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="relative max-w-xl">
          <SearchIcon size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="What do you want to listen to?"
            className="h-12 rounded-full pl-10 text-base"
          />
        </div>
        {debounced && (
          <div className="mt-3 flex gap-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm font-medium transition',
                  tab === t.id ? 'bg-white text-black' : 'bg-[var(--color-surface-2)] text-white hover:bg-white/10',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Browse all (empty state) */}
      {!debounced && (
        <Section title="Browse all">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {(genres ?? []).map((g) => (
              <GenreTile key={g.id} name={g.name} href={`/genre/${g.id}` as Route} />
            ))}
          </div>
        </Section>
      )}

      {debounced && !isFetching && data?.length === 0 && (
        <p className="text-center text-[var(--color-text-muted)]">No results for &quot;{debounced}&quot;.</p>
      )}

      {/* ALL: Top result + first songs */}
      {debounced && tab === 'all' && data && data.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          {top && (
            <section>
              <h2 className="mb-3 text-2xl font-bold">Top result</h2>
              <button
                onClick={() => activateHit(top)}
                className="group relative flex w-full flex-col gap-4 rounded-lg bg-[var(--color-surface)] p-5 text-left transition hover:bg-[var(--color-surface-2)]"
              >
                <div className={cn('relative size-24 overflow-hidden bg-[var(--color-surface-2)] shadow-lg', top.type === 'artist' ? 'rounded-full' : 'rounded')}>
                  {top.coverUrl ? (
                    <Image src={top.coverUrl} alt="" fill sizes="96px" className="object-cover" unoptimized />
                  ) : (
                    <span className="grid size-full place-items-center"><User size={32} /></span>
                  )}
                </div>
                <div>
                  <p className="truncate text-2xl font-bold">{top.title}</p>
                  <p className="mt-1 text-sm capitalize text-[var(--color-text-muted)]">
                    {top.type}{top.type !== 'artist' && top.artistName ? ` · ${top.artistName}` : ''}
                  </p>
                </div>
                <span className="absolute bottom-5 right-5 grid size-12 translate-y-2 place-items-center rounded-full bg-[var(--color-accent)] text-black opacity-0 shadow-xl transition group-hover:translate-y-0 group-hover:opacity-100">
                  <Play size={22} fill="currentColor" className="ml-0.5" />
                </span>
              </button>
            </section>
          )}

          {rows.length > 0 && (
            <section>
              <h2 className="mb-3 text-2xl font-bold">Songs</h2>
              <div className="flex flex-col rounded-lg bg-[var(--color-surface)] p-2">
                {rows.slice(0, 5).map((t, i) => (
                  <TrackRow key={t.id} track={t} index={i} context={rows} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ALL: artists + albums rows */}
      {debounced && tab === 'all' && artists.length > 0 && (
        <Section title="Artists">
          <CardGrid>
            {artists.map((a) => (
              <MediaCard key={a.id} coverUrl={a.coverUrl} title={a.title} subtitle="Artist" rounded href={(a.slug ? `/artist/${a.slug}` : '/search') as Route} />
            ))}
          </CardGrid>
        </Section>
      )}
      {debounced && tab === 'all' && albums.length > 0 && (
        <Section title="Albums">
          <CardGrid>
            {albums.map((a) => (
              <MediaCard key={a.id} coverUrl={a.coverUrl} title={a.title} subtitle={a.artistName ?? 'Album'} href={`/album/${a.id}` as Route} />
            ))}
          </CardGrid>
        </Section>
      )}

      {/* SONGS tab */}
      {debounced && tab === 'track' && (
        rows.length > 0 ? (
          <div className="flex flex-col rounded-lg bg-[var(--color-surface)] p-2">
            {rows.map((t, i) => (
              <TrackRow key={t.id} track={t} index={i} context={rows} />
            ))}
          </div>
        ) : (
          <p className="text-[var(--color-text-muted)]">No songs found.</p>
        )
      )}

      {/* ARTISTS tab */}
      {debounced && tab === 'artist' && (
        artists.length > 0 ? (
          <CardGrid>
            {artists.map((a) => (
              <MediaCard key={a.id} coverUrl={a.coverUrl} title={a.title} subtitle="Artist" rounded href={(a.slug ? `/artist/${a.slug}` : '/search') as Route} />
            ))}
          </CardGrid>
        ) : (
          <p className="text-[var(--color-text-muted)]">No artists found.</p>
        )
      )}

      {/* ALBUMS tab */}
      {debounced && tab === 'album' && (
        albums.length > 0 ? (
          <CardGrid>
            {albums.map((a) => (
              <MediaCard key={a.id} coverUrl={a.coverUrl} title={a.title} subtitle={a.artistName ?? 'Album'} href={`/album/${a.id}` as Route} />
            ))}
          </CardGrid>
        ) : (
          <p className="text-[var(--color-text-muted)]">No albums found.</p>
        )
      )}
    </div>
  );
}
