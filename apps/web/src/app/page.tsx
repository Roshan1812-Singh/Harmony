import Link from 'next/link';
import { Music2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
          <Music2 className="text-[var(--color-accent)]" />
          Harmony
        </Link>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/auth/login">Log in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/auth/register">Sign up free</Link>
          </Button>
        </nav>
      </header>

      <main className="flex-1 flex flex-col">
        <section className="px-6 py-24 sm:py-32 max-w-5xl mx-auto text-center">
          <span className="inline-block rounded-full border border-[var(--color-border)] px-4 py-1 text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-6">
            Royalty-free · Public domain · Creative Commons
          </span>
          <h1 className="text-5xl sm:text-7xl font-bold leading-tight tracking-tight">
            Free music for everyone.
            <br />
            <span className="text-[var(--color-accent)]">Forever.</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-[var(--color-text-muted)] max-w-2xl mx-auto">
            A streaming home for legally distributable music. Discover new artists,
            build your library, and listen on any device — without licensing nightmares.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3 flex-wrap">
            <Button asChild size="lg">
              <Link href="/auth/register">Start listening</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/home">Browse without an account</Link>
            </Button>
          </div>
        </section>

        <section className="px-6 py-16 bg-[var(--color-surface)]">
          <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
            <Feature title="Only legal music" body="Every track is either Creative Commons, public domain, royalty-free, or artist-uploaded. No takedown surprises." />
            <Feature title="Lossless-ready streaming" body="Adaptive HLS playback with MP3 fallback. Range requests for instant seeking. CDN-edge caching." />
            <Feature title="Built for artists" body="Upload, manage releases, see analytics, and reach listeners without a label." />
          </div>
        </section>

        <footer className="px-6 py-8 text-sm text-[var(--color-text-muted)] flex justify-between flex-wrap gap-2 border-t border-[var(--color-border)]">
          <span>© Harmony — open source music streaming.</span>
          <div className="flex gap-4">
            <Link href="/docs/security" className="hover:underline">Security</Link>
            <Link href="/docs/api" className="hover:underline">API</Link>
            <Link href="https://github.com" className="hover:underline">GitHub</Link>
          </div>
        </footer>
      </main>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="font-semibold text-lg">{title}</h3>
      <p className="mt-2 text-[var(--color-text-muted)] text-sm">{body}</p>
    </div>
  );
}
