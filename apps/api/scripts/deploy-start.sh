#!/usr/bin/env sh
# Boot script for the deployed Harmony API.
# Applies the Prisma schema and the additive custom SQL (FTS, indexes, join
# tables) that the project maintains outside of `prisma migrate`, then starts.
set -e

cd "$(dirname "$0")/.."
PRISMA="../../node_modules/.bin/prisma"

echo "==> Applying Prisma schema (db push)..."
node "$PRISMA" db push --skip-generate

echo "==> Applying custom SQL migrations..."
for f in prisma/sql/*.sql; do
  [ -e "$f" ] || continue
  echo "    -> $f"
  node "$PRISMA" db execute --file "$f" --schema prisma/schema.prisma || \
    echo "       (skipped/failed — likely already applied)"
done

echo "==> Starting Harmony API..."
exec node dist/main.js
