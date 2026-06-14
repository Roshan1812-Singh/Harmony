'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Music2, Upload as UploadIcon } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCurrentUser } from '@/hooks/use-auth';
import { LICENSES } from '@harmony/shared';

interface SignedUpload {
  uploadUrl: string;
  key: string;
  expiresAt: string;
}

interface Genre {
  id: string;
  name: string;
}

export default function UploadPage() {
  const { data: user } = useCurrentUser();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [license, setLicense] = useState<(typeof LICENSES)[number]>('CC_BY');
  const [progress, setProgress] = useState<number>(0);

  const { data: genres = [] } = useQuery({
    queryKey: ['genres'],
    queryFn: () => api<Genre[]>('/genres'),
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file || !title) throw new Error('Missing file or title');
      const signed = await api<SignedUpload>('/uploads/audio/sign', {
        method: 'POST',
        body: { filename: file.name, contentType: file.type, size: file.size },
      });

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', signed.uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`S3 ${xhr.status}`)));
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(file);
      });

      await api('/tracks', {
        method: 'POST',
        body: { title, license, sourceKey: signed.key },
      });
    },
    onSuccess: () => {
      toast.success('Track uploaded — transcoding in progress.');
      setFile(null);
      setTitle('');
      setProgress(0);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!user) return <div className="p-6">Sign in to upload music.</div>;
  if (user.role !== 'ARTIST' && user.role !== 'ADMIN') {
    return (
      <div className="p-6">
        <p className="mb-3">Only artist accounts can upload tracks.</p>
        <Button asChild>
          <a href="/profile">Become an artist</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-3xl font-bold mb-6">Upload a track</h1>

      <div className="flex flex-col gap-4">
        <label className="rounded-lg border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-8 grid place-items-center text-center cursor-pointer hover:bg-[var(--color-surface-2)]">
          {file ? (
            <div className="flex items-center gap-3">
              <Music2 />
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <UploadIcon />
              <p>Click to choose an audio file</p>
              <p className="text-xs text-[var(--color-text-muted)]">MP3, WAV, FLAC, OGG up to 100 MB</p>
            </div>
          )}
          <input
            type="file"
            hidden
            accept="audio/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <label>
          <span className="text-xs text-[var(--color-text-muted)]">Title</span>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Track title" />
        </label>

        <label>
          <span className="text-xs text-[var(--color-text-muted)]">License</span>
          <select
            className="w-full h-10 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
            value={license}
            onChange={(e) => setLicense(e.target.value as (typeof LICENSES)[number])}
          >
            {LICENSES.map((l) => (
              <option key={l} value={l}>
                {l.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            By uploading you affirm you have the right to distribute this track under the chosen license.
          </p>
        </label>

        {progress > 0 && progress < 100 && (
          <div className="rounded-full bg-[var(--color-surface-2)] h-2 overflow-hidden">
            <div className="h-full bg-[var(--color-accent)]" style={{ width: `${progress}%` }} />
          </div>
        )}

        <Button onClick={() => upload.mutate()} disabled={!file || !title || upload.isPending}>
          {upload.isPending ? 'Uploading…' : 'Upload track'}
        </Button>
      </div>
    </div>
  );
}
