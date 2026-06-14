'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterInput } from '@harmony/shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRegister } from '@/hooks/use-auth';
import { HarmonyApiError } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const reg = useRegister();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (data: RegisterInput) => {
    try {
      await reg.mutateAsync(data);
      toast.success('Welcome! Check your email to verify your account.');
      router.push('/home');
    } catch (err) {
      const msg =
        err instanceof HarmonyApiError ? err.problem.detail ?? err.problem.title : 'Sign up failed';
      toast.error(msg);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Create your account</h1>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        Already have one?{' '}
        <Link href="/auth/login" className="text-[var(--color-accent)] hover:underline">
          Log in
        </Link>
      </p>

      <form className="mt-6 flex flex-col gap-3" onSubmit={handleSubmit(onSubmit)}>
        <label className="block">
          <span className="text-xs text-[var(--color-text-muted)]">Display name</span>
          <Input autoComplete="nickname" {...register('displayName')} />
          {errors.displayName && (
            <p className="text-xs text-[var(--color-danger)] mt-1">{errors.displayName.message}</p>
          )}
        </label>
        <label className="block">
          <span className="text-xs text-[var(--color-text-muted)]">Email</span>
          <Input type="email" autoComplete="email" {...register('email')} />
          {errors.email && <p className="text-xs text-[var(--color-danger)] mt-1">{errors.email.message}</p>}
        </label>
        <label className="block">
          <span className="text-xs text-[var(--color-text-muted)]">Password</span>
          <Input type="password" autoComplete="new-password" {...register('password')} />
          {errors.password && (
            <p className="text-xs text-[var(--color-danger)] mt-1">{errors.password.message}</p>
          )}
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            ≥ 8 characters, with a letter, a digit, and a symbol.
          </p>
        </label>
        <Button type="submit" disabled={isSubmitting || reg.isPending}>
          {isSubmitting || reg.isPending ? 'Creating account…' : 'Create account'}
        </Button>
        <p className="text-xs text-[var(--color-text-muted)]">
          By signing up you agree to our <Link href="/terms" className="underline">Terms</Link> and{' '}
          <Link href="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </form>
    </div>
  );
}
