#!/usr/bin/env bash
# The existing fixture is used only on the disposable database.
set -euo pipefail
: "${DATABASE_URL:?}"
if [[ ! "$DATABASE_URL" =~ ^postgres(ql)?://[^/]+@(127\.0\.0\.1|localhost)(:[0-9]+)?/khoonemoon_check$ ]]; then
  echo 'refusing chore concurrency test outside disposable database' >&2; exit 1
fi
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
cid=00000000-0000-4000-8000-0000000000c1
revision=$(psql "$DATABASE_URL" -Atq -c "select completion_revision from public.chores where id='$cid'")
before=$(psql "$DATABASE_URL" -Atq -c "select count(*) from public.chore_completions where chore_id='$cid'")
mkfifo "$tmp/ready"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q >"$tmp/first" 2>&1 <<SQL &
begin;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);
select public.complete_chore_expected_version('$cid',$revision);
\! echo ready > $tmp/ready
select pg_sleep(2);
commit;
SQL
pid=$!
timeout 15 cat "$tmp/ready" >/dev/null || { kill "$pid" || true; exit 1; }
if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q >"$tmp/second" 2>&1 <<SQL
begin;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}',true);
select public.complete_chore_expected_version('$cid',$revision);
commit;
SQL
then echo 'concurrent completion accepted twice' >&2; exit 1; fi
wait "$pid"
grep -q CHORE_VERSION_CHANGED "$tmp/second" || { cat "$tmp/second" >&2; exit 1; }
after=$(psql "$DATABASE_URL" -Atq -c "select count(*) from public.chore_completions where chore_id='$cid'")
[[ $after -eq $((before+1)) ]] || { echo 'unexpected completion count' >&2; exit 1; }
echo 'Two-device stale chore completion guard passed.'
