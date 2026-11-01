#!/usr/bin/env bash
# Only the isolated CI database. Two connections race one creation request.
set -euo pipefail
: "${DATABASE_URL:?}"
if [[ ! "$DATABASE_URL" =~ ^postgres(ql)?://[^/]+@(127\.0\.0\.1|localhost)(:[0-9]+)?/khoonemoon_check$ ]]; then
  echo 'refusing create concurrency test outside disposable database' >&2; exit 1
fi
work=$(mktemp -d)
trap 'status=$?; if [ "$status" -ne 0 ]; then for file in "$work"/*.log; do [ ! -f "$file" ] || cat "$file" >&2; done; fi; rm -rf "$work"' EXIT
mkfifo "$work/ready"
payload='{"title":"parallel-idempotent-fixture","visibility":"PRIVATE","status":"PENDING","priority":"NORMAL","assigneeIds":[],"recurrence":{"frequency":"NONE"}}'
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q >"$work/first.log" 2>&1 <<SQL &
begin;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);
set local role authenticated;
select public.mobile_create_once('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','task','$payload');
\! echo ready > $work/ready
select pg_sleep(3);
commit;
SQL
pid=$!
timeout 15 cat "$work/ready" >/dev/null || { kill "$pid" || true; exit 1; }
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q >"$work/second.log" 2>&1 <<SQL
begin;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);
set local role authenticated;
select public.mobile_create_once('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','task','$payload');
commit;
SQL
wait "$pid"
count=$(psql "$DATABASE_URL" -Atq -c "select count(*) from public.tasks where title='parallel-idempotent-fixture'")
[[ "$count" = 1 ]] || { echo 'concurrent create produced a duplicate' >&2; exit 1; }
first=$(grep -Eo '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' "$work/first.log" | tail -1)
second=$(grep -Eo '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' "$work/second.log" | tail -1)
[[ -n "$first" && "$first" = "$second" ]] || { echo 'concurrent results differ' >&2; exit 1; }
echo 'Concurrent create retry guard passed.'
