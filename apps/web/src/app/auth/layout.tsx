import Link from 'next/link';
import { Music2 } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <aside className="hidden md:flex flex-col justify-between p-10 bg-gradient-to-br from-[#0a3d22] via-[#0a0a0c] to-[#1a0a3d] relative overflow-hidden">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
          <Music2 className="text-[var(--color-accent)]" />
          Harmony
        </Link>
        <div>
          <h2 className="text-3xl font-bold leading-tight max-w-xs">
            Music that's <span className="text-[var(--color-accent)]">always</span> legal to stream.
          </h2>
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">
            Royalty-free, public domain, and Creative Commons libraries — plus tracks uploaded by independent artists.
          </p>
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">
          © Harmony — open source music streaming.
        </p>
      </aside>
      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
