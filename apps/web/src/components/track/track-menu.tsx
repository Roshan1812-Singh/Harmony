'use client';

import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ListPlus, Plus, ListEnd, Heart, User, Disc3, Radio, Trash2, Download, Check } from 'lucide-react';
import type { PublicPlaylist } from '@harmony/shared';
import { api } from '@/lib/api';
import { usePlayer } from '@/stores/player';
import { useDownloads } from '@/stores/downloads';
import { toPlayerTrack } from '@/lib/play';
import { useCurrentUser } from '@/hooks/use-auth';
import type { TrackRowItem } from './track-row';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';

export function TrackMenu({
  track,
  liked,
  onLikedChange,
  open,
  onOpenChange,
  playlistId,
  children,
}: {
  track: TrackRowItem;
  liked?: boolean;
  onLikedChange?: (liked: boolean) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** When the track is shown inside a playlist, enables "Remove from this playlist". */
  playlistId?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const playNext = usePlayer((s) => s.playNext);
  const enqueue = usePlayer((s) => s.enqueue);
  const downloaded = useDownloads((s) => !!s.ids[track.id]);
  const downloadProgress = useDownloads((s) => s.progress[track.id]);
  const download = useDownloads((s) => s.download);
  const removeDownload = useDownloads((s) => s.remove);
  const isDownloading = downloadProgress != null;

  const { data: playlists = [] } = useQuery({
    enabled: !!user && open !== false,
    queryKey: ['playlists', 'me'],
    queryFn: () => api<PublicPlaylist[]>('/playlists/me'),
    staleTime: 60_000,
  });

  const pt = toPlayerTrack(track);

  async function addToPlaylist(playlistId: string) {
    try {
      await api(`/playlists/${playlistId}/tracks`, { method: 'POST', body: { trackId: track.id } });
      qc.invalidateQueries({ queryKey: ['playlist', playlistId] });
    } catch {
      /* ignore */
    }
  }

  async function newPlaylistWithTrack() {
    const name = window.prompt('New playlist name', track.title);
    if (!name) return;
    try {
      const pl = await api<PublicPlaylist>('/playlists', { method: 'POST', body: { name } });
      await addToPlaylist(pl.id);
      qc.invalidateQueries({ queryKey: ['playlists', 'me'] });
    } catch {
      /* ignore */
    }
  }

  async function removeFromPlaylist() {
    if (!playlistId) return;
    try {
      await api(`/playlists/${playlistId}/tracks/${track.id}`, { method: 'DELETE' });
      qc.invalidateQueries({ queryKey: ['playlist', playlistId] });
    } catch {
      /* ignore */
    }
  }

  async function toggleLike() {
    const next = !liked;
    onLikedChange?.(next);
    try {
      await api(`/tracks/${track.id}/like`, { method: next ? 'POST' : 'DELETE' });
      qc.invalidateQueries({ queryKey: ['library', 'liked'] });
    } catch {
      onLikedChange?.(!next); // revert on failure
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => playNext(pt)}>
          <Radio size={16} className="mr-2" /> Play next
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => enqueue(pt)}>
          <ListEnd size={16} className="mr-2" /> Add to queue
        </DropdownMenuItem>

        {user && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ListPlus size={16} className="mr-2" /> Add to playlist
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onSelect={newPlaylistWithTrack}>
                <Plus size={16} className="mr-2" /> New playlist
              </DropdownMenuItem>
              {playlists.length > 0 && <DropdownMenuSeparator />}
              {playlists.map((p) => (
                <DropdownMenuItem key={p.id} onSelect={() => addToPlaylist(p.id)} className="truncate">
                  {p.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {user && (
          <DropdownMenuItem onSelect={toggleLike}>
            <Heart size={16} className="mr-2" fill={liked ? 'currentColor' : 'none'} />
            {liked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
          </DropdownMenuItem>
        )}

        {downloaded ? (
          <DropdownMenuItem onSelect={() => removeDownload(track.id)}>
            <Check size={16} className="mr-2 text-[var(--color-accent)]" /> Remove download
          </DropdownMenuItem>
        ) : isDownloading ? (
          <DropdownMenuItem disabled onSelect={(e) => e.preventDefault()}>
            <Download size={16} className="mr-2" /> Downloading… {Math.round((downloadProgress ?? 0) * 100)}%
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => download(pt)}>
            <Download size={16} className="mr-2" /> Download
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push(`/artist/${track.artist.slug}`)}>
          <User size={16} className="mr-2" /> Go to artist
        </DropdownMenuItem>
        {track.album && (
          <DropdownMenuItem onSelect={() => router.push(`/album/${track.album!.id}`)}>
            <Disc3 size={16} className="mr-2" /> Go to album
          </DropdownMenuItem>
        )}
        {playlistId && user && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={removeFromPlaylist} className="text-[var(--color-danger)]">
              <Trash2 size={16} className="mr-2" /> Remove from this playlist
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
