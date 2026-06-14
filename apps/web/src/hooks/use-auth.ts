'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, HarmonyApiError } from '@/lib/api';
import type { PublicUser } from '@harmony/shared';

export function useCurrentUser() {
  return useQuery<PublicUser | null>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        return await api<PublicUser>('/auth/me');
      } catch (err) {
        if (err instanceof HarmonyApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 60_000,
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
