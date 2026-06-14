'use client';

import { useEffect, useState } from 'react';
import { Play, Download as DownloadIcon, WifiOff } from 'lucide-react';
import { idbAllMeta, type OfflineMeta } from '@/lib/offline-db';
import { useDownloads } from '@/stores/downloads';
import { playTracks } from '@/lib/play';
import { TrackRow, type TrackRowItem } from '@/components/track/track-row';
import { formatDuration } from '@/lib/utils';

function toRow(m: OfflineMeta): TrackRowItem {
  return {
    ...m,
    artist: { id: m.artistId ?? '', displayName: m.artistName, slug: m.artistSlug ?? '' },
    album: null,
  };
}

export default function DownloadsPage() {
  const ids = useDownloads((s) => s.ids);
  const ready = useDownloads((s) => s.ready);
  const init = useDownloads((s) => s.init);
  const [metas, setMetas] = useState<OfflineMeta[]>([]);

  useEffect(() => {
    void init();
  }, [init]);

  // Reload metadata whenever the set of downloaded ids changes.
  useEffect(() => {
    let active = true;
    void idbAllMeta().then((m) => {
      if (active) setMetas(m);
    });
    return () => {
      active = false;
    };
  }, [ids]);

  const rows = metas.map(toRow);
  const totalMs = metas.reduce((s, m) => s + m.durationMs, 0);
  const totalMb = metas.reduce((s, m) => s + m.size, 0) / (1024 * 1024);

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header
        className="-mx-4 sm:-mx-6 flex items-end gap-6 px-4 sm:px-6 pt-10 pb-8"
        style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 40%, var(--color-bg) 100%)' }}
      >
        <div className="grid size-40 sm:size-52 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-700 shadow-2xl">
          <DownloadIcon size={72} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide">Available offline</p>
          <h1 className="text-5xl font-bold sm:text-7xl">Downloads</h1>
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">
            {metas.length} songs · {formatDuration(totalMs)} · {totalMb.toFixed(1)} MB
          </p>
        </div>
      </header>

      {!ready ? (
        <p className="text-[var(--color-text-muted)]">Loading…</p>
      ) : metas.length > 0 ? (
        <>
          <button
            aria-label="Play downloads"
            onClick={() => playTracks(metas, 0)}
            className="grid size-14 place-items-center rounded-full bg-[var(--color-accent)] text-black shadow-xl transition hover:scale-105"
          >
            <Play size={26} fill="currentColor" className="ml-1" />
          </button>
          <div className="flex flex-col rounded-lg bg-[var(--color-surface)] p-2">
            {rows.map((t, i) => (
              <TrackRow key={t.id} track={t} index={i} context={rows} />
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg bg-[var(--color-surface)] p-10 text-center text-[var(--color-text-muted)]">
          <WifiOff size={32} />
          <p>No downloads yet. Tap the &ldquo;…&rdquo; menu on any song and choose <strong>Download</strong> to listen offline.</p>
        </div>
      )}
    </div>
  );
}
