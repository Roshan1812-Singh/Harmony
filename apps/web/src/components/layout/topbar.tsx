'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Music2, Search, Download } from 'lucide-react';

export function TopBar() {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-gradient-to-b from-black/80 to-black/20 backdrop-blur px-4 sm:px-6 py-3">
      <div className="flex items-center gap-2">
        <button
          aria-label="Back"
          onClick={() => router.back()}
          className="grid size-8 place-items-center rounded-full bg-black/60 text-white"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          aria-label="Forward"
          onClick={() => router.forward()}
          className="grid size-8 place-items-center rounded-full bg-black/60 text-white"
        >
          <ChevronRight size={18} />
        </button>
        <Link href="/home" className="md:hidden flex items-center gap-2 ml-2 font-semibold">
          <Music2 size={18} className="text-[var(--color-accent)]" />
          Harmony
        </Link>
      </div>

      <div className="flex items-center gap-2">
        {/* Mobile-only quick nav — the sidebar (which holds Search/Downloads) is hidden on phones. */}
        <Link
          href="/search"
          aria-label="Search"
          className="md:hidden grid size-8 place-items-center rounded-full text-white hover:bg-white/10"
        >
          <Search size={20} />
        </Link>
        <Link
          href="/library/downloads"
          aria-label="Downloads"
          className="md:hidden grid size-8 place-items-center rounded-full text-white hover:bg-white/10"
        >
          <Download size={20} />
        </Link>
      </div>
    </header>
  );
}
