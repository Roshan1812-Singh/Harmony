'use client';

import { use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { Clock, Play } from 'lucide-react';
import { api } from '@/lib/api';
import { TrackRow, ArtistLinks, type TrackRowItem } from '@/components/track/track-row';
import { usePlayer } from '@/stores/player';
import { Button } from '@/components/ui/button';
import { formatDuration } from '@/lib/utils';

interface AlbumDetail {
  id: string;
  title: string;
  coverUrl: string | null;
  releaseDate: string | null;
  license: string;
  artist: { id: string; displayName: string; slug: string; coverUrl?: string | null };
  tracks: (TrackRowItem & { trackNumber: number | null })[];
}

export default function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const setQueue = usePlayer((s) => s.setQueue);

  const { data: album, isLoading } = useQuery({
    queryKey: ['album', id],
    queryFn: () => api<AlbumDetail>(`/albums/${id}`),
  });

  if (isLoading) return <div className="p-6 text-[var(--color-text-muted)]">Loading…</div>;
  if (!album) return <div className="p-6">Album not found.</div>;

  const totalMs = album.tracks.reduce((sum, t) => sum + t.durationMs, 0);
  const year = album.releaseDate?.slice(0, 4);

  return (
    <div className="-mx-4 -mt-4 flex flex-col sm:-mx-6">
      {/* Gradient header */}
      <header className="bg-gradient-to-b from-[var(--color-surface-2)] to-[var(--color-surface)] px-4 pb-6 pt-16 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
          <div className="size-44 shrink-0 overflow-hidden rounded-lg bg-[var(--color-surface-2)] shadow-2xl sm:size-56">
            {album.coverUrl && (
              <Image
                src={album.coverUrl}
                alt=""
                width={224}
                height={224}
                className="size-full object-cover"
                unoptimized
              />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider">Album</p>
            <h1 className="mt-2 break-words text-4xl font-extrabold leading-tight sm:text-6xl">
              {album.title}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-muted)]">
              {album.artist.coverUrl && (
                <Image
                  src={album.artist.coverUrl}
                  alt=""
                  width={24}
                  height={24}
                  className="size-6 rounded-full object-cover"
                  unoptimized
                />
              )}
              <Link href={`/artist/${album.artist.slug}`} className="font-semibold text-white hover:underline">
                {album.artist.displayName}
              </Link>
              {year && <span>{'· ' + year}</span>}
              <span>
                {'· ' + album.tracks.length} {album.tracks.length === 1 ? 'song' : 'songs'}
              </span>
              <span>{'· ' + formatDuration(totalMs)}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Action bar */}
      <div className="flex items-center gap-4 px-4 py-4 sm:px-6">
        <Button
          size="lg"
          onClick={() => album.tracks.length && setQueue(album.tracks)}
          className="size-14 rounded-full p-0 shadow-lg transition hover:scale-105"
          aria-label="Play album"
        >
          <Play size={24} fill="currentColor" />
        </Button>
      </div>

      {/* Track list */}
      <div className="px-4 pb-10 sm:px-6">
        <div className="grid grid-cols-[16px_1fr_auto] items-center gap-3 border-b border-[var(--color-border)] px-3 pb-2 text-xs uppercase tracking-wider text-[var(--color-text-muted)] sm:grid-cols-[16px_4fr_auto]">
          <span className="text-right">#</span>
          <span>Title</span>
          <span className="pr-2">
            <Clock size={16} />
          </span>
        </div>
        <div className="mt-1 flex flex-col">
          {album.tracks.map((t, i) => (
            <TrackRow key={t.id} track={t} index={i} context={album.tracks} />
          ))}
        </div>
        {album.tracks.length === 0 && (
          <p className="px-3 py-6 text-sm text-[var(--color-text-muted)]">No songs in this album yet.</p>
        )}
        <p className="mt-6 px-3 text-xs text-[var(--color-text-muted)]">
          {year && `Released ${year} · `}
          <ArtistLinks track={{ artist: album.artist }} />
        </p>
      </div>
    </div>
  );
}
