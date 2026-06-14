import { usePlayer, type PlayerTrack } from '@/stores/player';

/**
 * Flexible shape covering both the `/tracks` list items (nested `artist`/`album`
 * objects) and `/search` track hits (flat `artistName`/`albumTitle` fields).
 */
export interface PlayableLike {
  id: string;
  title: string;
  durationMs?: number;
  coverUrl?: string | null;
  artistId?: string;
  artistName?: string;
  artistSlug?: string;
  albumTitle?: string;
  albumSlug?: string;
  artist?: { id: string; displayName: string; slug: string } | null;
  album?: { id: string; title: string; slug?: string; coverUrl?: string | null } | null;
}

export function toPlayerTrack(t: PlayableLike): PlayerTrack {
  return {
    id: t.id,
    title: t.title,
    durationMs: t.durationMs ?? 0,
    artistId: t.artistId ?? t.artist?.id ?? '',
    artistName: t.artistName ?? t.artist?.displayName ?? 'Unknown artist',
    artistSlug: t.artistSlug ?? t.artist?.slug,
    albumTitle: t.albumTitle ?? t.album?.title,
    albumSlug: t.albumSlug ?? t.album?.slug,
    coverUrl: t.coverUrl ?? t.album?.coverUrl ?? null,
  };
}

/** Replace the queue with `tracks` and start playing at `index`. */
export function playTracks(tracks: PlayableLike[], index = 0): void {
  usePlayer.getState().setQueue(tracks.map(toPlayerTrack), index);
}
