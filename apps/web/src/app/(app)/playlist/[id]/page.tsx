'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ListMusic, Play, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { TrackRow, type TrackRowItem } from '@/components/track/track-row';
import { usePlayer } from '@/stores/player';
import { formatDuration } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface PlaylistDetail {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  isCollaborative: boolean;
  items: Array<{ trackId: string; position: number; track: TrackRowItem }>;
}

export default function PlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const setQueue = usePlayer((s) => s.setQueue);

  const { data: playlist } = useQuery({
    queryKey: ['playlist', id],
    queryFn: () => api<PlaylistDetail>(`/playlists/${id}`),
  });

  async function rename() {
    const name = window.prompt('Rename playlist', playlist?.name);
    if (!name || name === playlist?.name) return;
    await api(`/playlists/${id}`, { method: 'PATCH', body: { name } });
    qc.invalidateQueries({ queryKey: ['playlist', id] });
    qc.invalidateQueries({ queryKey: ['playlists', 'me'] });
  }

  async function remove() {
    if (!window.confirm('Delete this playlist? This cannot be undone.')) return;
    await api(`/playlists/${id}`, { method: 'DELETE' });
    qc.invalidateQueries({ queryKey: ['playlists', 'me'] });
    router.push('/library');
  }

  if (!playlist) return <div className="p-6 text-[var(--color-text-muted)]">Loading…</div>;
  const tracks = playlist.items.map((i) => i.track);
  const totalMs = tracks.reduce((s, t) => s + t.durationMs, 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col sm:flex-row gap-6 items-end">
        <div className="size-48 sm:size-60 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 grid place-items-center shadow-xl">
          <ListMusic size={64} className="text-white/80" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Playlist</p>
          <h1 className="text-4xl sm:text-6xl font-bold leading-tight">{playlist.name}</h1>
          {playlist.description && (
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">{playlist.description}</p>
          )}
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            {tracks.length} tracks · {formatDuration(totalMs)} · {playlist.isPublic ? 'Public' : 'Private'}
            {playlist.isCollaborative && ' · Collaborative'}
          </p>
        </div>
      </header>

      <div className="flex items-center gap-4">
        <Button
          size="lg"
          className="size-14 rounded-full p-0"
          onClick={() => setQueue(tracks)}
          aria-label="Play playlist"
          disabled={tracks.length === 0}
        >
          <Play size={22} fill="currentColor" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label="Playlist options" className="p-2 text-[var(--color-text-muted)] hover:text-white">
              <MoreHorizontal size={28} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={rename}>
              <Pencil size={16} className="mr-2" /> Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={remove} className="text-[var(--color-danger)]">
              <Trash2 size={16} className="mr-2" /> Delete playlist
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {tracks.length > 0 ? (
        <div className="flex flex-col rounded-lg bg-[var(--color-surface)] p-2">
          {tracks.map((t, i) => (
            <TrackRow key={t.id} track={t} index={i} context={tracks} playlistId={id} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg bg-[var(--color-surface)] p-8 text-center text-[var(--color-text-muted)]">
          This playlist is empty.
        </div>
      )}
    </div>
  );
}
