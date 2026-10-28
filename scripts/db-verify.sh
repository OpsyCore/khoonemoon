#!/usr/bin/env bash
# Applies the local auth shim + every migration, then runs the RLS assertions.
#
# Local:
#   createdb khoonemoon_check
#   DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/khoonemoon_check npm run db:verify
#
# CI: the workflow starts a disposable Postgres service and runs the same command.
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

echo "==> applying auth shim"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f db/local/00_auth_shim.sql

echo "==> applying migrations"
for file in $(ls drizzle/*.sql | sort); do
  echo "    $file"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$file"
done

echo "==> applying migrations a second time (idempotency check)"
for file in $(ls drizzle/*.sql | sort); do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$file"
done

echo "==> running RLS / grant / integrity assertions"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f db/local/10_assertions.sql

echo "==> database verification passed"
