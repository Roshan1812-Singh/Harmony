'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useState, type ReactNode } from 'react';
import { Player } from '@/components/player/player';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error: unknown) => {
              if (typeof error === 'object' && error && 'status' in error) {
                const s = (error as { status: number }).status;
                if (s >= 400 && s < 500 && s !== 408) return false;
              }
              return failureCount < 2;
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      {children}
      <Player />
      <Toaster richColors theme="dark" position="bottom-right" />
    </QueryClientProvider>
  );
}
