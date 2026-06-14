'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@harmony/shared';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ForgotPasswordPage() {
  const [done, setDone] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    await api('/auth/forgot-password', { method: 'POST', body: data });
    setDone(true);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Reset password</h1>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        Enter your email and we'll send a reset link.
      </p>

      {done ? (
        <div className="mt-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm">
          If an account exists for that email, you'll receive a reset link shortly.
        </div>
      ) : (
        <form className="mt-6 flex flex-col gap-3" onSubmit={handleSubmit(onSubmit)}>
          <Input type="email" placeholder="you@example.com" {...register('email')} />
          {errors.email && <p className="text-xs text-[var(--color-danger)]">{errors.email.message}</p>}
          <Button disabled={isSubmitting}>Send reset link</Button>
          <Link href="/auth/login" className="text-xs text-center text-[var(--color-text-muted)] hover:underline">
            Back to login
          </Link>
        </form>
      )}
    </div>
  );
}
