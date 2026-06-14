import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  WEB_ORIGIN: z.string().url(),
});

export function validateEnv(raw: Record<string, unknown>): Record<string, unknown> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    // Format errors deterministically so failed boots are easy to read in logs.
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment variables → ${issues}`);
  }
  return raw;
}
