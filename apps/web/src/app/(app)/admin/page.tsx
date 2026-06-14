'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, Ban, BadgeCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCurrentUser } from '@/hooks/use-auth';

interface Stats {
  users: number;
  artists: number;
  tracks: number;
  plays7d: number;
}

interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: 'USER' | 'ARTIST' | 'ADMIN';
  banned: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
}

export default function AdminPage() {
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const [q, setQ] = useState('');

  const { data: stats } = useQuery({
    enabled: user?.role === 'ADMIN',
    queryKey: ['admin', 'stats'],
    queryFn: () => api<Stats>('/admin/stats'),
  });

  const { data: users = [] } = useQuery({
    enabled: user?.role === 'ADMIN',
    queryKey: ['admin', 'users', q],
    queryFn: () => api<AdminUser[]>(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  });

  const ban = useMutation({
    mutationFn: (u: AdminUser) =>
      api(`/admin/users/${u.id}/${u.banned ? 'unban' : 'ban'}`, {
        method: 'PATCH',
        body: u.banned ? {} : { reason: 'Admin action' },
      }),
    onSuccess: () => {
      toast.success('User updated');
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  if (!user) return <div className="p-6">Sign in to continue.</div>;
  if (user.role !== 'ADMIN') {
    return (
      <div className="p-6 flex items-center gap-3 text-[var(--color-danger)]">
        <Shield /> Admins only.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center gap-3">
        <Shield className="text-[var(--color-accent)]" />
        <h1 className="text-3xl font-bold">Admin</h1>
      </header>

      {stats && (
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card label="Users" value={stats.users} />
          <Card label="Artists" value={stats.artists} />
          <Card label="Tracks" value={stats.tracks} />
          <Card label="Plays (7d)" value={stats.plays7d} />
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Users</h2>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by email or name…"
            className="max-w-sm"
          />
        </div>
        <div className="rounded-lg bg-[var(--color-surface)] divide-y divide-white/5">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{u.displayName}</p>
                <p className="truncate text-xs text-[var(--color-text-muted)]">{u.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded-full bg-[var(--color-surface-2)]">{u.role}</span>
                {u.emailVerifiedAt && <BadgeCheck size={14} className="text-[var(--color-accent)]" />}
                <Button
                  size="sm"
                  variant={u.banned ? 'secondary' : 'danger'}
                  onClick={() => ban.mutate(u)}
                >
                  <Ban size={14} /> {u.banned ? 'Unban' : 'Ban'}
                </Button>
              </div>
            </div>
          ))}
          {users.length === 0 && (
            <p className="p-4 text-[var(--color-text-muted)]">No users found.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-[var(--color-surface)] p-4">
      <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-bold mt-1">{value.toLocaleString()}</p>
    </div>
  );
}
