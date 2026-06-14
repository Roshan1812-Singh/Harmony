import { z } from 'zod';

/**
 * Password policy: ≥ 8 chars, ≥ 1 letter, ≥ 1 digit, ≥ 1 symbol.
 * Length cap of 72 because bcrypt silently truncates beyond that — we'd rather reject.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Must be at least 8 characters')
  .max(72, 'Must be 72 characters or fewer')
  .regex(/[A-Za-z]/, 'Must contain a letter')
  .regex(/\d/, 'Must contain a digit')
  .regex(/[^A-Za-z0-9]/, 'Must contain a symbol');

export const emailSchema = z.string().email().max(254).toLowerCase().trim();

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, 'Too short')
  .max(40, 'Too long')
  .regex(/^[\p{L}\p{N} '._-]+$/u, 'Contains invalid characters');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(256),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().min(10).max(256),
});
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
