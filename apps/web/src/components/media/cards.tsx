'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Section wrapper with a heading and optional "Show all" link. */
export function Section({
  title,
  href,
  children,
}: {
  title: string;
  href?: Route;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-end justify-between">
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        {href && (
          <Link href={href} className="text-sm font-semibold text-[var(--color-text-muted)] hover:underline">
            Show all
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** Responsive grid of cards. */
export function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {children}
    </div>
  );
}

/**
 * Spotify-style media card: square cover, title, subtitle, and a floating
 * green play button that appears on hover. Either `onPlay` (plays) or `href`
 * (navigates) — usually both.
 */
export function MediaCard({
  coverUrl,
  title,
  subtitle,
  href,
  onPlay,
  rounded,
}: {
  coverUrl: string | null | undefined;
  title: string;
  subtitle?: string;
  href?: Route;
  onPlay?: () => void;
  rounded?: boolean;
}) {
  const inner = (
    <div className="group relative flex flex-col gap-3 rounded-lg bg-[var(--color-surface)] p-3 transition-colors hover:bg-[var(--color-surface-2)]">
      <div
        className={cn(
          'relative aspect-square overflow-hidden bg-[var(--color-surface-2)] shadow-lg',
          rounded ? 'rounded-full' : 'rounded-md',
        )}
      >
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="grid size-full place-items-center text-3xl text-[var(--color-text-muted)]">♪</div>
        )}
        {onPlay && (
          <button
            aria-label={`Play ${title}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPlay();
            }}
            className={cn(
              'absolute bottom-2 right-2 grid size-12 translate-y-2 place-items-center rounded-full bg-[var(--color-accent)] text-black opacity-0 shadow-xl transition-all',
              'group-hover:translate-y-0 group-hover:opacity-100 hover:scale-105',
            )}
          >
            <Play size={20} fill="currentColor" className="ml-0.5" />
          </button>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate font-semibold">{title}</p>
        {subtitle && <p className="mt-0.5 line-clamp-2 text-sm text-[var(--color-text-muted)]">{subtitle}</p>}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    );
  }
  return <div className="cursor-pointer" onClick={onPlay}>{inner}</div>;
}

const TILE_COLORS = [
  '#1db954', '#e8115b', '#7358ff', '#e91429', '#1e3264', '#8d67ab',
  '#148a08', '#b02897', '#dc148c', '#0d73ec', '#bc5900', '#503750',
  '#477d95', '#777777', '#af2896', '#509bf5', '#ba5d07', '#e1118c',
];

function hashIndex(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % mod;
}

/** Colorful "Browse all" category tile (Spotify search style). */
export function GenreTile({ name, href }: { name: string; href: Route }) {
  const color = TILE_COLORS[hashIndex(name, TILE_COLORS.length)];
  return (
    <Link
      href={href}
      className="relative aspect-[1.4/1] overflow-hidden rounded-lg p-4 transition-transform hover:scale-[1.02]"
      style={{ backgroundColor: color }}
    >
      <span className="text-xl font-bold text-white drop-shadow">{name}</span>
      <div
        className="absolute -bottom-3 -right-3 size-20 rotate-[25deg] rounded-md bg-black/25 shadow-2xl"
        aria-hidden
      />
    </Link>
  );
}
