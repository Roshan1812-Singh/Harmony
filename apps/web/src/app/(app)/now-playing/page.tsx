'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import * as Slider from '@radix-ui/react-slider';
import { useShallow } from 'zustand/react/shallow';
import {
  Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Download, CheckCircle2, Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatDuration } from '@/lib/utils';
import { currentTrack, usePlayer } from '@/stores/player';
import { useDownloads } from '@/stores/downloads';

export default function NowPlayingPage() {
  const { track, isPlaying, positionMs, repeat, shuffle, queue, index, toggle, next, prev, seek, toggleShuffle, cycleRepeat, jumpTo } =
    usePlayer(
      useShallow((s) => ({
        track: currentTrack(s),
        isPlaying: s.isPlaying,
        positionMs: s.positionMs,
        repeat: s.repeat,
        shuffle: s.shuffle,
        queue: s.queue,
        index: s.index,
        toggle: s.toggle,
        next: s.next,
        prev: s.prev,
        seek: s.seek,
        toggleShuffle: s.toggleShuffle,
        cycleRepeat: s.cycleRepeat,
        jumpTo: s.jumpTo,
      })),
    );

  const downloaded = useDownloads((s) => (track ? !!s.ids[track.id] : false));
  const dlProgress = useDownloads((s) => (track ? s.progress[track.id] : undefined));
  const download = useDownloads((s) => s.download);
  const removeDownload = useDownloads((s) => s.remove);

  const { data: lyricsData } = useQuery({
    enabled: !!track,
    queryKey: ['lyrics', track?.id],
    queryFn: () => api<{ lyrics: string | null }>(`/tracks/${track!.id}/lyrics`),
    staleTime: 5 * 60_000,
  });

  if (!track) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-[var(--color-text-muted)]">
        Nothing is playing. <Link href="/home" className="ml-1 text-[var(--color-accent)] underline">Find something</Link>.
      </div>
    );
  }

  const duration = track.durationMs || 0;
  const upNext = queue.slice(index + 1, index + 1 + 30);

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-8 overflow-x-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
      <div className="flex min-w-0 flex-col items-center gap-6">
        <div className="relative aspect-square w-full max-w-[18rem] overflow-hidden rounded-xl bg-[var(--color-surface-2)] shadow-2xl sm:max-w-md">
          {track.coverUrl && <Image src={track.coverUrl} alt="" fill sizes="(max-width: 640px) 80vw, 448px" className="object-cover" unoptimized priority />}
        </div>

        <div className="w-full min-w-0 max-w-md text-center">
          <h1 className="truncate text-2xl font-bold sm:text-3xl">{track.title}</h1>
          {track.artistSlug ? (
            <Link href={`/artist/${track.artistSlug}`} className="text-[var(--color-text-muted)] hover:underline">
              {track.artistName}
            </Link>
          ) : (
            <p className="text-[var(--color-text-muted)]">{track.artistName}</p>
          )}
        </div>

        <div className="flex w-full min-w-0 max-w-md items-center gap-3">
          <span className="w-10 shrink-0 text-right text-xs tabular-nums text-[var(--color-text-muted)]">{formatDuration(positionMs)}</span>
          <Slider.Root
            min={0}
            max={Math.max(duration, 1)}
            value={[Math.min(positionMs, duration)]}
            onValueChange={([v]) => seek(v ?? 0)}
            className="relative flex h-4 grow items-center"
            aria-label="Seek"
          >
            <Slider.Track className="relative h-1 grow overflow-hidden rounded-full bg-[var(--color-border)]">
              <Slider.Range className="absolute h-full bg-[var(--color-accent)]" />
            </Slider.Track>
            <Slider.Thumb className="block size-3 rounded-full bg-white shadow" />
          </Slider.Root>
          <span className="w-10 shrink-0 text-xs tabular-nums text-[var(--color-text-muted)]">{formatDuration(duration)}</span>
        </div>

        <div className="flex items-center gap-5">
          <button aria-label="Shuffle" onClick={toggleShuffle} className={cn('text-[var(--color-text-muted)] hover:text-white', shuffle && 'text-[var(--color-accent)]')}>
            <Shuffle size={22} />
          </button>
          <button aria-label="Previous" onClick={prev} className="text-[var(--color-text-muted)] hover:text-white">
            <SkipBack size={28} />
          </button>
          <button
            aria-label={isPlaying ? 'Pause' : 'Play'}
            onClick={toggle}
            className="grid size-16 place-items-center rounded-full bg-white text-black transition hover:scale-105"
          >
            {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
          </button>
          <button aria-label="Next" onClick={next} className="text-[var(--color-text-muted)] hover:text-white">
            <SkipForward size={28} />
          </button>
          <button aria-label="Repeat" onClick={cycleRepeat} className={cn('text-[var(--color-text-muted)] hover:text-white', repeat !== 'off' && 'text-[var(--color-accent)]')}>
            {repeat === 'one' ? <Repeat1 size={22} /> : <Repeat size={22} />}
          </button>
        </div>

        {downloaded ? (
          <button
            onClick={() => removeDownload(track.id)}
            className="flex items-center gap-2 text-sm font-medium text-[var(--color-accent)]"
          >
            <CheckCircle2 size={18} /> Downloaded · remove
          </button>
        ) : dlProgress != null ? (
          <span className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <Loader2 size={18} className="animate-spin" /> Downloading… {Math.round(dlProgress * 100)}%
          </span>
        ) : (
          <button
            onClick={() => download(track)}
            className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-muted)] hover:text-white"
          >
            <Download size={18} /> Download
          </button>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-8">
        <section className="min-w-0">
          <h2 className="mb-3 text-lg font-bold">Lyrics</h2>
          {lyricsData?.lyrics ? (
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-[var(--color-text-muted)]">{lyricsData.lyrics}</pre>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">Lyrics not available for this track.</p>
          )}
        </section>

        {upNext.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-bold">Next up</h2>
            <div className="flex flex-col">
              {upNext.map((t, i) => (
                <button
                  key={`${t.id}-${i}`}
                  onClick={() => jumpTo(index + 1 + i)}
                  className="group flex items-center gap-3 rounded-md p-2 text-left hover:bg-white/5"
                >
                  <div className="relative size-10 shrink-0 overflow-hidden rounded bg-[var(--color-surface-2)]">
                    {t.coverUrl && <Image src={t.coverUrl} alt="" fill sizes="40px" className="object-cover" unoptimized />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t.title}</p>
                    <p className="truncate text-xs text-[var(--color-text-muted)]">{t.artistName}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
