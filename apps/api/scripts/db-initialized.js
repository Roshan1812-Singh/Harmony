// Exit 0 if the database schema already exists (the `users` table is present),
// else exit 1. Used by deploy-start.sh to decide whether to run `prisma db push`
// (which is only safe on a fresh DB — re-running it on a live DB would try to
// drop the raw-SQL `search_vector` columns/indexes).
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
prisma
  .$queryRawUnsafe("SELECT to_regclass('public.users') AS t")
  .then((rows) => {
    const initialized = Array.isArray(rows) && rows[0] && rows[0].t;
    process.exit(initialized ? 0 : 1);
  })
  .catch(() => process.exit(1))
  .finally(() => prisma.$disconnect());
