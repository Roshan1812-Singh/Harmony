'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, LogOut, Music2, User, Shield } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useCurrentUser, useLogout } from '@/hooks/use-auth';

export function TopBar() {
  const router = useRouter();
  const { data: user } = useCurrentUser();
  const logout = useLogout();

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
        {!user ? (
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/auth/register">Sign up</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/auth/login">Log in</Link>
            </Button>
          </>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm" className="px-3">
                <span className="size-7 grid place-items-center rounded-full bg-[var(--color-accent)] text-[var(--color-accent-fg)] font-bold text-xs">
                  {user.displayName?.[0]?.toUpperCase()}
                </span>
                <span className="hidden sm:inline">{user.displayName}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href="/profile" className="flex items-center gap-2">
                  <User size={14} /> Profile
                </Link>
              </DropdownMenuItem>
              {user.role === 'ADMIN' && (
                <DropdownMenuItem asChild>
                  <Link href="/admin" className="flex items-center gap-2">
                    <Shield size={14} /> Admin
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => logout.mutate(undefined, { onSuccess: () => router.push('/') })}
                className="flex items-center gap-2 text-[var(--color-danger)]"
              >
                <LogOut size={14} /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
