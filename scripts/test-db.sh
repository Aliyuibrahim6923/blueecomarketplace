#!/usr/bin/env bash
# Runs every migration, the seed and the SQL test suite against a throwaway
# PostgreSQL cluster (no Docker, no Supabase project needed).
#
#   ./scripts/test-db.sh            # uses initdb/pg_ctl from PATH or /usr/lib/postgresql/*/bin
#   DATABASE_URL=postgres://... ./scripts/test-db.sh   # use an existing EMPTY scratch database
#
# Never point DATABASE_URL at a real Supabase project: the shim creates auth/storage stubs.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS="$ROOT/supabase/migrations"
TESTS="$ROOT/supabase/tests"
SEED="$ROOT/supabase/seed.sql"

PGBIN="${PGBIN:-}"
if [[ -z "$PGBIN" ]]; then
  if command -v pg_ctl >/dev/null 2>&1; then PGBIN="$(dirname "$(command -v pg_ctl)")";
  else PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"; fi
fi

cleanup() { :; }
if [[ -z "${DATABASE_URL:-}" ]]; then
  WORK="$(mktemp -d)"
  PORT="${PGPORT_TEST:-54329}"
  RUN_AS=()
  if [[ "$(id -u)" == "0" ]]; then
    # PostgreSQL refuses to run as root; use the postgres OS user.
    chown postgres "$WORK"
    RUN_AS=(su postgres -s /bin/bash -c)
    run() { "${RUN_AS[@]}" "$*"; }
  else
    run() { bash -c "$*"; }
  fi
  run "$PGBIN/initdb -D $WORK/data -U postgres --auth=trust -E UTF8 >/dev/null"
  run "$PGBIN/pg_ctl -D $WORK/data -o '-p $PORT -k $WORK -c listen_addresses=' -l $WORK/log -w start >/dev/null"
  cleanup() { run "$PGBIN/pg_ctl -D $WORK/data -m fast stop >/dev/null" || true; rm -rf "$WORK"; }
  trap cleanup EXIT
  DATABASE_URL="postgresql://postgres@/postgres?host=$WORK&port=$PORT"
fi

cd "$ROOT"
PSQL=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -X)

echo "→ Supabase shim"
"${PSQL[@]}" -f "$TESTS/00_supabase_shim.sql" >/dev/null

echo "→ Migrations"
for f in "$MIGRATIONS"/*.sql; do
  echo "   $(basename "$f")"
  "${PSQL[@]}" -f "$f" >/dev/null
done

echo "→ Seed"
"${PSQL[@]}" -f "$SEED" >/dev/null

echo "→ Tests"
status=0
for f in "$TESTS"/[0-9][0-9]_*.sql; do
  [[ "$(basename "$f")" == "00_supabase_shim.sql" ]] && continue
  if out="$("${PSQL[@]}" -f "$f" 2>&1)"; then
    echo "   ✓ $(basename "$f")"
    [[ -n "${VERBOSE:-}" ]] && echo "$out"
  else
    echo "   ✗ $(basename "$f")"
    echo "$out" | sed 's/^/     /'
    status=1
  fi
done

exit $status
