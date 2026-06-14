#!/usr/bin/env sh
# Boot script for the deployed Harmony API.
# Applies the Prisma schema and the additive custom SQL (FTS, indexes, join
# tables) that the project maintains outside of `prisma migrate`, then starts.
set -e

cd "$(dirname "$0")/.."
PRISMA="../../node_modules/.bin/prisma"

# `db push` is only safe on a fresh DB. On a live DB it would try to drop the
# raw-SQL search_vector columns/indexes, so run it only when uninitialized.
if node scripts/db-initialized.js 2>/dev/null; then
  echo "==> Database already initialized — skipping db push."
else
  echo "==> Fresh database — applying Prisma schema (db push)..."
  node "$PRISMA" db push --skip-generate
fi

echo "==> Applying custom SQL migrations (idempotent)..."
for f in prisma/sql/*.sql; do
  [ -e "$f" ] || continue
  echo "    -> $f"
  node "$PRISMA" db execute --file "$f" --schema prisma/schema.prisma || \
    echo "       (skipped/failed — likely already applied)"
done

echo "==> Starting Harmony API..."
exec node dist/main.js
