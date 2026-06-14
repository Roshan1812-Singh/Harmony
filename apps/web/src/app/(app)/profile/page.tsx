'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCurrentUser } from '@/hooks/use-auth';
import type { PublicUser } from '@harmony/shared';

export default function ProfilePage() {
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    if (user) setDisplayName(user.displayName);
  }, [user]);

  const save = useMutation({
    mutationFn: () => api<PublicUser>('/users/me', { method: 'PATCH', body: { displayName } }),
    onSuccess: () => {
      toast.success('Profile updated');
      qc.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });

  if (!user) return <div className="p-6">Sign in to manage your profile.</div>;

  return (
    <div className="max-w-md">
      <h1 className="text-3xl font-bold mb-6">Your profile</h1>
      <div className="flex flex-col gap-4">
        <label className="block">
          <span className="text-xs text-[var(--color-text-muted)]">Email</span>
          <Input value={user.email} disabled />
        </label>
        <label className="block">
          <span className="text-xs text-[var(--color-text-muted)]">Display name</span>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save changes'}
        </Button>
        <p className="text-xs text-[var(--color-text-muted)]">
          Role: <span className="text-white">{user.role}</span> · Email verified:{' '}
          <span className="text-white">{user.emailVerified ? 'Yes' : 'No'}</span>
        </p>
      </div>
    </div>
  );
}
