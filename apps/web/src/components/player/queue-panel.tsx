'use client';

import Image from 'next/image';
import { X, Play, Trash2, Volume2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { usePlayer } from '@/stores/player';
import { cn } from '@/lib/utils';

export function QueuePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { queue, index, isPlaying, jumpTo, removeAt } = usePlayer(
    useShallow((s) => ({
      queue: s.queue,
      index: s.index,
      isPlaying: s.isPlaying,
      jumpTo: s.jumpTo,
      removeAt: s.removeAt,
    })),
  );

  if (!open) return null;

  const current = index >= 0 ? queue[index] : null;
  const upNext = queue.map((t, i) => ({ t, i })).filter(({ i }) => i > index);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-80 max-w-[85vw] flex-col bg-[var(--color-surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h2 className="text-lg font-bold">Queue</h2>
          <button aria-label="Close queue" onClick={onClose} className="p-1 text-[var(--color-text-muted)] hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 pb-28">
          {current && (
            <section className="mb-4">
              <h3 className="mb-2 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Now playing</h3>
              <QueueRow t={current} active onPlay={() => jumpTo(index)} playing={isPlaying} />
            </section>
          )}

          <h3 className="mb-2 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Next up</h3>
          {upNext.length === 0 ? (
            <p className="px-1 text-sm text-[var(--color-text-muted)]">Nothing queued.</p>
          ) : (
            <div className="flex flex-col">
              {upNext.map(({ t, i }) => (
                <QueueRow key={`${t.id}-${i}`} t={t} onPlay={() => jumpTo(i)} onRemove={() => removeAt(i)} />
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function QueueRow({
  t,
  active,
  playing,
  onPlay,
  onRemove,
}: {
  t: { id: string; title: string; artistName: string; coverUrl: string | null };
  active?: boolean;
  playing?: boolean;
  onPlay: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className={cn('group flex items-center gap-3 rounded-md p-2 hover:bg-white/5', active && 'bg-white/5')}>
      <button onClick={onPlay} className="relative size-10 shrink-0 overflow-hidden rounded bg-[var(--color-surface-2)]">
        {t.coverUrl && <Image src={t.coverUrl} alt="" fill sizes="40px" className="object-cover" unoptimized />}
        <span className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 transition group-hover:opacity-100">
          {active && playing ? <Volume2 size={16} className="text-[var(--color-accent)]" /> : <Play size={16} className="text-white" />}
        </span>
      </button>
      <button onClick={onPlay} className="min-w-0 flex-1 text-left">
        <p className={cn('truncate text-sm font-medium', active && 'text-[var(--color-accent)]')}>{t.title}</p>
        <p className="truncate text-xs text-[var(--color-text-muted)]">{t.artistName}</p>
      </button>
      {onRemove && (
        <button
          aria-label="Remove from queue"
          onClick={onRemove}
          className="p-1 text-[var(--color-text-muted)] opacity-0 transition hover:text-white group-hover:opacity-100"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}
