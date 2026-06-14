'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Play, MoreHorizontal, Heart, Volume2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatDuration, formatPlayCount } from '@/lib/utils';
import { usePlayer, type PlayerTrack } from '@/stores/player';
import { TrackMenu } from './track-menu';

export interface TrackRowItem extends PlayerTrack {
  trackNumber?: number | null;
  playCount?: number | null;
  album?: { id: string; title: string; slug: string; coverUrl: string | null } | null;
  artist: { id: string; displayName: string; slug: string };
  /** All credited artists (from the track_artists join), ordered. */
  artists?: Array<{ artist: { id: string; displayName: string; slug: string } }>;
}

/** Renders every credited artist as a comma-separated list of links. */
export function ArtistLinks({
  track,
  className,
}: {
  track: Pick<TrackRowItem, 'artist' | 'artists'>;
  className?: string;
}) {
  const credited = track.artists?.length ? track.artists.map((a) => a.artist) : [track.artist];
  return (
    <span className={className}>
      {credited.map((a, i) => (
        <span key={`${a.id}-${i}`}>
          {i > 0 && ', '}
          <Link
            href={`/artist/${a.slug}`}
            onClick={(e) => e.stopPropagation()}
            className="hover:text-white hover:underline"
          >
            {a.displayName}
          </Link>
        </span>
      ))}
    </span>
  );
}

export function TrackRow({
  track,
  index,
  context,
  liked,
  playlistId,
  showPlayCount,
}: {
  track: TrackRowItem;
  index: number;
  context: TrackRowItem[];
  liked?: boolean;
  playlistId?: string;
  showPlayCount?: boolean;
}) {
  const setQueue = usePlayer((s) => s.setQueue);
  const currentId = usePlayer((s) => (s.index >= 0 ? s.queue[s.index]?.id : null));
  const isPlaying = usePlayer((s) => s.isPlaying);
  const isCurrent = currentId === track.id;

  const [isLiked, setIsLiked] = useState(!!liked);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setIsLiked(!!liked), [liked]);

  async function toggleLike() {
    const next = !isLiked;
    setIsLiked(next);
    try {
      await api(`/tracks/${track.id}/like`, { method: next ? 'POST' : 'DELETE' });
    } catch {
      setIsLiked(!next);
    }
  }

  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        setMenuOpen(true);
      }}
      onDoubleClick={() => setQueue(context, index)}
      className={cn(
        'group grid grid-cols-[2rem_1fr_1fr_2.5rem_3rem_2rem] items-center gap-3 px-3 py-2 rounded hover:bg-white/5',
        isCurrent && 'bg-white/5',
      )}
    >
      <button
        aria-label={`Play ${track.title}`}
        className="grid place-items-center text-[var(--color-text-muted)] group-hover:text-white"
        onClick={() => setQueue(context, index)}
      >
        {isCurrent && isPlaying ? (
          <Volume2 size={16} className="text-[var(--color-accent)]" />
        ) : (
          <>
            <span className={cn('group-hover:hidden tabular-nums text-sm', isCurrent && 'text-[var(--color-accent)]')}>
              {track.trackNumber ?? index + 1}
            </span>
            <Play size={16} className="hidden group-hover:block" />
          </>
        )}
      </button>

      <div className="flex items-center gap-3 min-w-0">
        {track.coverUrl && (
          <div className="relative size-10 shrink-0 rounded bg-[var(--color-surface-2)] overflow-hidden">
            <Image src={track.coverUrl} alt="" fill sizes="40px" className="object-cover" unoptimized />
          </div>
        )}
        <div className="min-w-0">
          <p className={cn('truncate text-sm font-medium', isCurrent && 'text-[var(--color-accent)]')}>{track.title}</p>
          <ArtistLinks track={track} className="block truncate text-xs text-[var(--color-text-muted)]" />
        </div>
      </div>

      {showPlayCount ? (
        <span className="hidden md:block truncate text-sm text-[var(--color-text-muted)] tabular-nums">
          {track.playCount != null ? formatPlayCount(track.playCount) : ''}
        </span>
      ) : track.album ? (
        <Link
          href={`/album/${track.album.id}`}
          className="hidden md:block truncate text-sm text-[var(--color-text-muted)] hover:underline"
        >
          {track.album.title}
        </Link>
      ) : (
        <span className="hidden md:block" />
      )}

      <button
        aria-label={isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
        onClick={toggleLike}
        className={cn(
          'opacity-0 group-hover:opacity-100 text-[var(--color-text-muted)] hover:text-white',
          isLiked && 'opacity-100 text-[var(--color-accent)]',
        )}
      >
        <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
      </button>

      <span className="text-sm text-[var(--color-text-muted)] tabular-nums">{formatDuration(track.durationMs)}</span>

      <TrackMenu
        track={track}
        liked={isLiked}
        onLikedChange={setIsLiked}
        open={menuOpen}
        onOpenChange={setMenuOpen}
        playlistId={playlistId}
      >
        <button
          aria-label="More options"
          className="grid place-items-center text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 hover:text-white data-[state=open]:opacity-100"
        >
          <MoreHorizontal size={18} />
        </button>
      </TrackMenu>
    </div>
  );
}
