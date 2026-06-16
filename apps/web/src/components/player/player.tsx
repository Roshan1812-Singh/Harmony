'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Hls from 'hls.js';
import {
  Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume2, VolumeX,
  ListMusic, Maximize2,
} from 'lucide-react';
import { QueuePanel } from './queue-panel';
import { idbGetBlob } from '@/lib/offline-db';
import { useDownloads } from '@/stores/downloads';
import * as Slider from '@radix-ui/react-slider';
import { useShallow } from 'zustand/react/shallow';
import { api } from '@/lib/api';
import { cn, formatDuration } from '@/lib/utils';
import { currentTrack, usePlayer } from '@/stores/player';
import type { StreamManifest } from '@harmony/shared';
import { PLAYBACK_HEARTBEAT_INTERVAL_MS } from '@harmony/shared';

/**
 * Persistent bottom player.
 *
 *  – Uses hls.js for HLS playback; falls back to native MP3 on browsers without MSE.
 *  – Resolves a signed manifest URL whenever the current track changes.
 *  – Posts `/stream/heartbeat` every 15 seconds with cumulative msPlayed.
 *  – Auto-advances to the next track via `ended` event.
 */
export function Player() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const sentMsRef = useRef(0);
  const blobUrlRef = useRef<string | null>(null);
  const initDownloads = useDownloads((s) => s.init);

  const {
    track,
    isPlaying,
    volume,
    muted,
    shuffle,
    repeat,
    positionMs,
    seekRequestMs,
    queue,
    index,
    toggle,
    next,
    prev,
    seek,
    setPosition,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    clearSeekRequest,
  } = usePlayer(
    useShallow((s) => ({
      track: currentTrack(s),
      isPlaying: s.isPlaying,
      volume: s.volume,
      muted: s.muted,
      shuffle: s.shuffle,
      repeat: s.repeat,
      positionMs: s.positionMs,
      seekRequestMs: s.seekRequestMs,
      queue: s.queue,
      index: s.index,
      toggle: s.toggle,
      next: s.next,
      prev: s.prev,
      seek: s.seek,
      setPosition: s.setPosition,
      setVolume: s.setVolume,
      toggleMute: s.toggleMute,
      toggleShuffle: s.toggleShuffle,
      cycleRepeat: s.cycleRepeat,
      clearSeekRequest: s.clearSeekRequest,
    })),
  );

  const [queueOpen, setQueueOpen] = useState(false);

  const [manifestUrl, setManifestUrl] = useState<string | null>(null);
  const [manifestFormat, setManifestFormat] = useState<'hls' | 'mp3'>('hls');
  // Real playable length reported by the <audio> element. Preferred over
  // track.durationMs because the actual asset (preview vs full song) may differ.
  const [audioDurationMs, setAudioDurationMs] = useState(0);

  // Load manifest URL when current track changes.
  useEffect(() => {
    if (!track) {
      setManifestUrl(null);
      return;
    }
    setAudioDurationMs(0);
    // A new track is starting: immediately stop the previous source so its lingering
    // `timeupdate` events can't write a stale position (which made the next song begin
    // where the last one left off, and could instantly re-fire `ended`).
    const a = audioRef.current;
    if (a) {
      a.pause();
      try {
        a.currentTime = 0;
      } catch {
        /* not yet seekable */
      }
    }
    setPosition(0);
    let cancelled = false;
    const supportsMSE = typeof window !== 'undefined' && Hls.isSupported();
    const supportsNativeHls =
      typeof document !== 'undefined' &&
      document.createElement('audio').canPlayType('application/vnd.apple.mpegurl') !== '';
    const fmt = supportsMSE || supportsNativeHls ? 'hls' : 'mp3';

    // Offline-first: if the track has been downloaded, play the cached bytes
    // directly from IndexedDB (works with no network connection at all).
    const loadCachedOrManifest = async () => {
      try {
        const blob = await idbGetBlob(track.id);
        if (cancelled) return;
        if (blob) {
          if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
          const objUrl = URL.createObjectURL(blob);
          blobUrlRef.current = objUrl;
          setManifestUrl(objUrl);
          setManifestFormat('mp3');
          sentMsRef.current = 0;
          return;
        }
      } catch {
        /* fall through to network */
      }
      await loadManifest();
    };

    // Retry a few times so a transient network blip (e.g. the API briefly
    // restarting in dev) doesn't silently break playback.
    const loadManifest = async () => {
      let lastErr: unknown;
      for (let attempt = 0; attempt < 4 && !cancelled; attempt++) {
        try {
          const m = await api<StreamManifest>(`/stream/${track.id}/manifest?format=${fmt}`);
          if (cancelled) return;
          setManifestUrl(m.url);
          setManifestFormat(m.format);
          sentMsRef.current = 0;
          return;
        } catch (err) {
          lastErr = err;
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        }
      }
      if (!cancelled) {
        // eslint-disable-next-line no-console
        console.error('manifest load failed', lastErr);
      }
    };
    void loadCachedOrManifest();
    return () => {
      cancelled = true;
    };
  }, [track, setPosition]);

  // Attach source.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !manifestUrl) return;

    hlsRef.current?.destroy();
    hlsRef.current = null;

    if (manifestFormat === 'hls' && Hls.isSupported()) {
      const hls = new Hls({ lowLatencyMode: false });
      hls.loadSource(manifestUrl);
      hls.attachMedia(audio);
      hlsRef.current = hls;
    } else {
      audio.src = manifestUrl;
    }
    // Every manifest (re)attach corresponds to a freshly-selected track, so always
    // start from the beginning. Seeks are applied separately via the seek-request effect.
    audio.currentTime = 0;
    if (isPlaying) audio.play().catch(() => undefined);
    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifestUrl, manifestFormat]);

  // Play/pause sync.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) audio.play().catch(() => undefined);
    else audio.pause();
  }, [isPlaying, manifestUrl]);

  // Load the set of downloaded track ids once, and release any blob URL on unmount.
  useEffect(() => {
    void initDownloads();
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, [initDownloads]);

  // Volume / mute.
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume;
    }
  }, [volume, muted]);

  // Apply external seek requests (from the Now Playing view / progress bar).
  useEffect(() => {
    if (seekRequestMs == null) return;
    const audio = audioRef.current;
    if (audio) audio.currentTime = seekRequestMs / 1000;
    clearSeekRequest();
  }, [seekRequestMs, clearSeekRequest]);

  // Time update → store + heartbeat.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setPosition(Math.floor(audio.currentTime * 1000));
    const onEnd = () => next();
    const onMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setAudioDurationMs(Math.floor(audio.duration * 1000));
      }
    };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnd);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('durationchange', onMeta);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnd);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('durationchange', onMeta);
    };
  }, [next, setPosition]);

  // Heartbeat.
  useEffect(() => {
    if (!track || !isPlaying) return;
    const id = setInterval(() => {
      const audio = audioRef.current;
      if (!audio) return;
      const ms = Math.floor(audio.currentTime * 1000);
      if (ms <= sentMsRef.current) return;
      sentMsRef.current = ms;
      void api('/stream/heartbeat', {
        method: 'POST',
        body: { trackId: track.id, msPlayed: ms },
      }).catch(() => undefined);
    }, PLAYBACK_HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [track, isPlaying]);

  // Prefer the server's catalog duration — it's accurate, whereas the browser
  // frequently mis-reports the length of progressively-streamed .mp4/AAC files
  // (metadata atom at EOF), which made full songs look "cut in half". Fall back
  // to the element's duration only when the catalog value is missing.
  const duration = track?.durationMs && track.durationMs > 0 ? track.durationMs : audioDurationMs;

  // A single, always-mounted <audio> element. Rendering it conditionally would
  // swap DOM nodes when the queue fills, leaving the timeupdate listeners bound
  // to a detached element (which froze the progress timer at 0:00).
  const audioEl = <audio ref={audioRef} preload="auto" hidden />;

  if (queue.length === 0 || !track) {
    return audioEl;
  }

  return (
    <>
    {audioEl}
    <QueuePanel open={queueOpen} onClose={() => setQueueOpen(false)} />
    <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur">
      <div className="mx-auto grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-3 py-2 sm:px-6 sm:py-3 max-w-[1600px]">
        {/* Left: now playing */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/now-playing"
            aria-label="Open now playing"
            className="group relative size-14 shrink-0 rounded bg-[var(--color-surface-2)] overflow-hidden"
          >
            {track.coverUrl && (
              <Image
                src={track.coverUrl}
                alt=""
                fill
                sizes="56px"
                className="object-cover"
                unoptimized
              />
            )}
            <span className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 transition group-hover:opacity-100">
              <Maximize2 size={16} className="text-white" />
            </span>
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{track.title}</p>
            {track.artistSlug ? (
              <Link
                href={`/artist/${track.artistSlug}`}
                className="block truncate text-xs text-[var(--color-text-muted)] hover:underline"
              >
                {track.artistName}
              </Link>
            ) : (
              <span className="block truncate text-xs text-[var(--color-text-muted)]">{track.artistName}</span>
            )}
          </div>
        </div>

        {/* Centre: transport */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <button
              aria-label="Shuffle"
              onClick={toggleShuffle}
              className={cn('p-1.5 rounded text-[var(--color-text-muted)] hover:text-white', shuffle && 'text-[var(--color-accent)]')}
            >
              <Shuffle size={18} />
            </button>
            <button aria-label="Previous" onClick={prev} className="p-1.5 hover:text-white">
              <SkipBack size={20} />
            </button>
            <button
              aria-label={isPlaying ? 'Pause' : 'Play'}
              onClick={toggle}
              className="grid size-9 place-items-center rounded-full bg-white text-black hover:scale-105 active:scale-100 transition"
            >
              {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            </button>
            <button aria-label="Next" onClick={next} className="p-1.5 hover:text-white">
              <SkipForward size={20} />
            </button>
            <button
              aria-label="Repeat"
              onClick={cycleRepeat}
              className={cn('p-1.5 rounded text-[var(--color-text-muted)] hover:text-white', repeat !== 'off' && 'text-[var(--color-accent)]')}
            >
              {repeat === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
            </button>
          </div>
          <div className="hidden sm:flex items-center gap-2 w-full max-w-[480px]">
            <span className="text-xs tabular-nums text-[var(--color-text-muted)] w-10 text-right">
              {formatDuration(positionMs)}
            </span>
            <Slider.Root
              min={0}
              max={Math.max(duration, 1)}
              value={[Math.min(positionMs, duration)]}
              onValueChange={([v]) => seek(v ?? 0)}
              className="relative flex h-4 grow items-center"
              aria-label="Seek"
            >
              <Slider.Track className="relative h-1 grow overflow-hidden rounded-full bg-[var(--color-border)]">
                <Slider.Range className="absolute h-full bg-white" />
              </Slider.Track>
              <Slider.Thumb className="block size-3 rounded-full bg-white shadow" />
            </Slider.Root>
            <span className="text-xs tabular-nums text-[var(--color-text-muted)] w-10">
              {formatDuration(duration)}
            </span>
          </div>
        </div>

        {/* Right: queue + volume */}
        <div className="flex items-center justify-end gap-2">
          <button
            aria-label="Queue"
            onClick={() => setQueueOpen((v) => !v)}
            className={cn(
              'p-1.5 rounded text-[var(--color-text-muted)] hover:text-white',
              queueOpen && 'text-[var(--color-accent)]',
            )}
          >
            <ListMusic size={18} />
          </button>
          <button
            aria-label={muted ? 'Unmute' : 'Mute'}
            onClick={toggleMute}
            className="p-1.5 text-[var(--color-text-muted)] hover:text-white"
          >
            {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <Slider.Root
            min={0}
            max={1}
            step={0.01}
            value={[muted ? 0 : volume]}
            onValueChange={([v]) => setVolume(v ?? 0)}
            className="relative hidden sm:flex h-4 w-24 items-center"
            aria-label="Volume"
          >
            <Slider.Track className="relative h-1 grow overflow-hidden rounded-full bg-[var(--color-border)]">
              <Slider.Range className="absolute h-full bg-white" />
            </Slider.Track>
            <Slider.Thumb className="block size-3 rounded-full bg-white shadow" />
          </Slider.Root>
        </div>
      </div>
    </footer>
    </>
  );
}
