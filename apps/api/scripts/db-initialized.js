// Decides whether the database schema already exists, so deploy-start.sh knows
// whether to run `prisma db push` (only safe on a FRESH database — re-running it
// on a live DB would try to drop the raw-SQL `search_vector` columns/indexes and
// fail with a data-loss error, crash-looping the service).
//
// Exit 0 = "already initialized → skip db push"
// Exit 1 = "fresh database → run db push"
//
// IMPORTANT: managed Postgres (Neon free tier) can be briefly unreachable while
// it wakes from suspend. We retry, and if we still cannot verify, we exit 0
// (assume initialized) — the SAFE default, so a transient blip never triggers a
// destructive db push against a populated database.
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  const attempts = 6;
  for (let i = 1; i <= attempts; i++) {
    try {
      const rows = await prisma.$queryRawUnsafe("SELECT to_regclass('public.users') AS t");
      await prisma.$disconnect().catch(() => {});
      const initialized = Array.isArray(rows) && rows[0] && rows[0].t;
      process.exit(initialized ? 0 : 1);
    } catch (err) {
      console.error(`[db-initialized] attempt ${i}/${attempts} failed: ${err && err.message}`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  await prisma.$disconnect().catch(() => {});
  console.error('[db-initialized] could not verify schema; assuming initialized (skip db push).');
  process.exit(0);
}

void main();
