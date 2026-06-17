'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InstallButton } from '@/components/pwa/install-button';

const nav = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/search', label: 'Search', icon: Search },
] as const;

export function Sidebar() {
  const pathname = usePathname();

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
        <h3 className="px-2 py-1 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Library</h3>
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
      </div>

      <InstallButton />
    </aside>
  );
}
