'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PublicUser } from '@harmony/shared';

// Authentication has been removed — Harmony is now a free, account-less music
// player. `useCurrentUser` is kept (callers still import it) but resolves to a
// null user without ever hitting the network, so no `/auth/me` requests fire.
export function useCurrentUser() {
  return useQuery<PublicUser | null>({
    queryKey: ['auth', 'me'],
    queryFn: async () => null,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      api<PublicUser>('/auth/login', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth', 'me'] }),
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string; displayName: string }) =>
      api<PublicUser>('/auth/register', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth', 'me'] }),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      qc.setQueryData(['auth', 'me'], null);
      qc.invalidateQueries();
    },
  });
}
