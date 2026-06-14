'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Play } from 'lucide-react';
import { api } from '@/lib/api';
import { useCurrentUser } from '@/hooks/use-auth';
import { playTracks } from '@/lib/play';
import { TrackRow, type TrackRowItem } from '@/components/track/track-row';
import { formatPlayCount } from '@/lib/utils';

interface ArtistDetail {
  id: string;
  displayName: string;
  bio: string | null;
  coverUrl: string | null;
  verified: boolean;
  monthlyListeners: number;
  isFollowing: boolean;
  albums: Array<{ id: string; title: string; slug: string; coverUrl: string | null; releaseDate: string | null }>;
  _count: { followers: number; tracks: number };
}

export default function ArtistPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const [showAll, setShowAll] = useState(false);
  const [following, setFollowing] = useState(false);

  const { data: artist } = useQuery({
    queryKey: ['artist', slug],
    queryFn: () => api<ArtistDetail>(`/artists/${slug}`),
  });

  const { data: top } = useQuery({
    enabled: !!artist?.id,
    queryKey: ['artist', artist?.id, 'top'],
    queryFn: () => api<TrackRowItem[]>(`/artists/${artist!.id}/top-tracks`),
  });

  useEffect(() => {
    if (artist) setFollowing(artist.isFollowing);
  }, [artist]);

  const follow = useMutation({
    mutationFn: (next: boolean) =>
      api(`/users/${artist!.id}/follow`, { method: next ? 'POST' : 'DELETE' }),
    onMutate: (next) => setFollowing(next),
    onError: (_e, next) => setFollowing(!next),
    onSettled: () => qc.invalidateQueries({ queryKey: ['artist', slug] }),
  });

  if (!artist) return <div className="p-6 text-[var(--color-text-muted)]">Loading…</div>;

  const popular = top ?? [];
  const shown = showAll ? popular.slice(0, 10) : popular.slice(0, 5);

  return (
    <div className="-mx-4 -my-4 sm:-mx-6 flex flex-col">
      {/* Banner */}
      <header
        className="relative flex h-[40vh] min-h-[340px] items-end px-6 pb-6"
        style={{
          background: artist.coverUrl
            ? `linear-gradient(0deg, var(--color-bg) 0%, transparent 60%), linear-gradient(0deg, rgba(0,0,0,0.5), rgba(0,0,0,0.1)), url(${artist.coverUrl}) center 20% / cover`
            : 'linear-gradient(135deg, #1db95455, var(--color-bg))',
        }}
      >
        <div>
          {artist.verified && (
            <div className="flex items-center gap-2 text-sm font-medium">
              <BadgeCheck size={22} className="text-[#3d91f4]" fill="#3d91f4" stroke="white" />
              Verified Artist
            </div>
          )}
          <h1 className="text-5xl font-extrabold drop-shadow-lg sm:text-8xl">{artist.displayName}</h1>
          <p className="mt-4 text-sm font-medium">
            {formatPlayCount(artist.monthlyListeners)} monthly listeners
          </p>
        </div>
      </header>

      {/* Action bar + content over a subtle gradient */}
      <div
        className="flex flex-col gap-8 px-6 pt-6 pb-10"
        style={{ background: 'linear-gradient(180deg, rgba(40,40,48,0.6) 0%, var(--color-bg) 220px)' }}
      >
        <div className="flex items-center gap-6">
          <button
            aria-label={`Play ${artist.displayName}`}
            onClick={() => popular.length && playTracks(popular, 0)}
            disabled={popular.length === 0}
            className="grid size-14 place-items-center rounded-full bg-[var(--color-accent)] text-black shadow-xl transition hover:scale-105 disabled:opacity-50"
          >
            <Play size={26} fill="currentColor" className="ml-1" />
          </button>

          {user && (
            <button
              onClick={() => follow.mutate(!following)}
              className="rounded-full border border-white/40 px-5 py-1.5 text-sm font-bold hover:border-white hover:scale-105 transition"
            >
              {following ? 'Following' : 'Follow'}
            </button>
          )}
        </div>

        {shown.length > 0 && (
          <section>
            <h2 className="mb-2 text-2xl font-bold">Popular</h2>
            <div className="flex flex-col">
              {shown.map((t, i) => (
                <TrackRow key={t.id} track={t} index={i} context={popular} showPlayCount />
              ))}
            </div>
            {popular.length > 5 && (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="mt-2 px-3 text-sm font-bold text-[var(--color-text-muted)] hover:text-white"
              >
                {showAll ? 'Show less' : 'See more'}
              </button>
            )}
          </section>
        )}

        {artist.albums.length > 0 && (
          <section>
            <h2 className="mb-3 text-2xl font-bold">Discography</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {artist.albums.map((a) => (
                <Link
                  key={a.id}
                  href={`/album/${a.id}`}
                  className="rounded-lg bg-[var(--color-surface)] p-3 transition hover:bg-[var(--color-surface-2)]"
                >
                  <div className="mb-3 aspect-square overflow-hidden rounded bg-[var(--color-surface-2)] shadow-lg">
                    {a.coverUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.coverUrl} alt="" className="size-full object-cover" />
                    )}
                  </div>
                  <p className="truncate text-sm font-semibold">{a.title}</p>
                  <p className="truncate text-xs text-[var(--color-text-muted)]">
                    {a.releaseDate?.slice(0, 4) ?? '—'} · Album
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {artist.bio && (
          <section className="max-w-3xl">
            <h2 className="mb-3 text-2xl font-bold">About</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-muted)]">{artist.bio}</p>
          </section>
        )}
      </div>
    </div>
  );
}
