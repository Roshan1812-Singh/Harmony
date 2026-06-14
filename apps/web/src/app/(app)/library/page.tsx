'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCurrentUser } from '@/hooks/use-auth';
import type { PublicPlaylist } from '@harmony/shared';

export default function LibraryPage() {
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const { data: playlists = [] } = useQuery({
    enabled: !!user,
    queryKey: ['playlists', 'me'],
    queryFn: () => api<PublicPlaylist[]>('/playlists/me'),
  });

  const create = useMutation({
    mutationFn: () => api<PublicPlaylist>('/playlists', { method: 'POST', body: { name } }),
    onSuccess: () => {
      setName('');
      setCreating(false);
      qc.invalidateQueries({ queryKey: ['playlists', 'me'] });
    },
  });

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-[var(--color-text-muted)]">
          <Link href="/auth/login" className="text-[var(--color-accent)] underline">Sign in</Link> to access your library.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Your Library</h1>
        <Button onClick={() => setCreating((v) => !v)}>
          <Plus size={16} /> New playlist
        </Button>
      </div>

      {creating && (
        <div className="mb-6 flex gap-2">
          <Input
            placeholder="Playlist name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button disabled={!name || create.isPending} onClick={() => create.mutate()}>
            Create
          </Button>
        </div>
      )}

      {playlists.length === 0 ? (
        <p className="text-[var(--color-text-muted)]">No playlists yet. Create your first one.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {playlists.map((p) => (
            <Link
              key={p.id}
              href={`/playlist/${p.id}`}
              className="rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] p-3 transition"
            >
              <div className="aspect-square rounded bg-gradient-to-br from-purple-500 to-blue-500 mb-2" />
              <p className="truncate text-sm font-medium">{p.name}</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {(p as PublicPlaylist & { trackCount?: number }).trackCount ?? 0} tracks
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
