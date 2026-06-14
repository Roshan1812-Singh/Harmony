'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@harmony/shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLogin } from '@/hooks/use-auth';
import { HarmonyApiError } from '@/lib/api';
import { API_URL } from '@/lib/api-url';

export default function LoginPage() {
  const router = useRouter();
  const login = useLogin();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginInput) => {
    try {
      await login.mutateAsync(data);
      router.push('/home');
    } catch (err) {
      const msg =
        err instanceof HarmonyApiError ? err.problem.detail ?? err.problem.title : 'Login failed';
      toast.error(msg);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Log in to Harmony</h1>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        New here?{' '}
        <Link href="/auth/register" className="text-[var(--color-accent)] hover:underline">
          Create an account
        </Link>
      </p>

      <div className="mt-6 flex flex-col gap-2">
        <Button
          variant="secondary"
          onClick={() => (window.location.href = `${API_URL}/auth/oauth/google`)}
          className="w-full"
        >
          Continue with Google
        </Button>
        <Button
          variant="secondary"
          onClick={() => (window.location.href = `${API_URL}/auth/oauth/github`)}
          className="w-full"
        >
          Continue with GitHub
        </Button>
      </div>

      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
        <div className="h-px flex-1 bg-[var(--color-border)]" />
        or
        <div className="h-px flex-1 bg-[var(--color-border)]" />
      </div>

      <form className="flex flex-col gap-3" onSubmit={handleSubmit(onSubmit)}>
        <label className="block">
          <span className="text-xs text-[var(--color-text-muted)]">Email</span>
          <Input type="email" autoComplete="email" {...register('email')} />
          {errors.email && <p className="text-xs text-[var(--color-danger)] mt-1">{errors.email.message}</p>}
        </label>
        <label className="block">
          <span className="text-xs text-[var(--color-text-muted)]">Password</span>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              {...register('password')}
            />
            <button
              type="button"
              className="absolute right-2 top-2 text-xs text-[var(--color-text-muted)]"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-[var(--color-danger)] mt-1">{errors.password.message}</p>
          )}
        </label>
        <div className="text-right">
          <Link href="/auth/forgot-password" className="text-xs text-[var(--color-text-muted)] hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" disabled={isSubmitting || login.isPending}>
          {isSubmitting || login.isPending ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
    </div>
  );
}
