'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Library, Upload, Plus, Heart, ListMusic, Download } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/hooks/use-auth';
import { InstallButton } from '@/components/pwa/install-button';
import type { PublicPlaylist } from '@harmony/shared';

const nav = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/library', label: 'Your Library', icon: Library },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { data: user } = useCurrentUser();
  const { data: playlists = [] } = useQuery({
    enabled: !!user,
    queryKey: ['playlists', 'me'],
    queryFn: () => api<PublicPlaylist[]>('/playlists/me'),
    staleTime: 60_000,
  });

  return (
    <aside className="hidden md:flex w-72 shrink-0 flex-col gap-3 p-3 max-h-screen sticky top-0">
      <nav className="rounded-lg bg-[var(--color-surface)] p-2 flex flex-col gap-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname?.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
                active ? 'text-white bg-white/5' : 'text-[var(--color-text-muted)] hover:text-white',
              )}
            >
              <Icon size={20} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1 rounded-lg bg-[var(--color-surface)] p-2 flex flex-col gap-2 overflow-y-auto">
        <div className="flex items-center justify-between px-2 py-1">
          <h3 className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Playlists</h3>
          {user && (
            <Link
              href="/library?create=1"
              aria-label="Create playlist"
              className="p-1 text-[var(--color-text-muted)] hover:text-white"
            >
              <Plus size={16} />
            </Link>
          )}
        </div>
        {user && (
          <Link
            href="/library/liked"
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm',
              pathname === '/library/liked' ? 'bg-white/5 text-white' : 'text-[var(--color-text-muted)] hover:text-white',
            )}
          >
            <span className="grid size-8 place-items-center rounded bg-gradient-to-br from-purple-500 to-blue-500">
              <Heart size={16} className="fill-white text-white" />
            </span>
            Liked Songs
          </Link>
        )}
        <Link
          href="/library/downloads"
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm',
            pathname === '/library/downloads' ? 'bg-white/5 text-white' : 'text-[var(--color-text-muted)] hover:text-white',
          )}
        >
          <span className="grid size-8 place-items-center rounded bg-gradient-to-br from-emerald-500 to-teal-600">
            <Download size={16} className="text-white" />
          </span>
          Downloads
        </Link>
        {playlists.map((p) => (
          <Link
            key={p.id}
            href={`/playlist/${p.id}`}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm',
              pathname === `/playlist/${p.id}`
                ? 'bg-white/5 text-white'
                : 'text-[var(--color-text-muted)] hover:text-white',
            )}
          >
            <span className="grid size-8 place-items-center rounded bg-[var(--color-surface-2)]">
              <ListMusic size={14} />
            </span>
            <span className="truncate">{p.name}</span>
          </Link>
        ))}

        {!user && (
          <div className="px-3 py-2 text-sm text-[var(--color-text-muted)]">
            <Link href="/auth/login" className="underline">Sign in</Link> to create playlists.
          </div>
        )}
      </div>

      <InstallButton />

      {user?.role === 'ARTIST' && (
        <Link
          href="/upload"
          className="rounded-lg bg-[var(--color-surface)] p-3 flex items-center gap-3 text-sm font-medium hover:bg-[var(--color-surface-2)]"
        >
          <Upload size={18} /> Upload music
        </Link>
      )}
    </aside>
  );
}
