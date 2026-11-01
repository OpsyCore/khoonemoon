#!/usr/bin/env bash
# Two real PostgreSQL sessions, disposable CI database only. Verify both
# directions of the advisory-lock protocol; never run against production.
set -euo pipefail
: "${DATABASE_URL:?}"
if [[ ! "${DATABASE_URL}" =~ ^postgres(ql)?://[^/]+@(127\.0\.0\.1|localhost)(:[0-9]+)?/khoonemoon_check$ ]]; then
  echo 'refusing concurrency drill outside disposable khoonemoon_check database' >&2; exit 1
fi
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
uid=00000000-0000-4000-8000-0000000000a
home=00000000-0000-4000-8000-0000000000f1
one="household/$home/concurrency/linked.pdf"
two="household/$home/concurrency/retired.pdf"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -v one="$one" -v two="$two" <<'SQL'
insert into storage.objects(bucket_id,name,created_at,updated_at) values ('documents',:'one',now()-interval '8 days',now()-interval '8 days'),('documents',:'two',now()-interval '8 days',now()-interval '8 days');
SQL
mkfifo "$work/ready1" "$work/ready2"
# A document insert holds the path lock while uncommitted. Marking must wait,
# then observe the committed reference and refuse to retire the path.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -v home="$home" -v uid="$uid" -v path="$one" >"$work/first.log" 2>&1 <<SQL &
begin;
select set_config('request.jwt.claims','{"sub":"$uid","role":"authenticated"}',true);
set local role authenticated;
insert into public.documents(household_id,created_by,title,mime_type,file_size,storage_path,visibility) values (:'home',:'uid','concurrency','application/pdf',1,:'path','HOUSEHOLD_SHARED');
\! echo ready > $work/ready1
select pg_sleep(3);
commit;
SQL
pid=$!
timeout 15 cat "$work/ready1" >/dev/null || { kill "$pid" || true; echo 'first session did not start' >&2; exit 1; }
if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -v uid="$uid" -v path="$one" >"$work/mark.log" 2>&1 <<SQL
begin;
select set_config('request.jwt.claims','{"sub":"$uid","role":"authenticated"}',true);
set local role authenticated;
select public.mark_document_orphan_for_cleanup(:'path');
commit;
SQL
then echo 'cleanup accepted a concurrent document' >&2; exit 1; fi
wait "$pid"
grep -q DOCUMENT_REFERENCED "$work/mark.log"
# Marking holds the lock while uncommitted. A late insert must wait and fail.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -v uid="$uid" -v path="$two" >"$work/second.log" 2>&1 <<SQL &
begin;
select set_config('request.jwt.claims','{"sub":"$uid","role":"authenticated"}',true);
set local role authenticated;
select public.mark_document_orphan_for_cleanup(:'path');
\! echo ready > $work/ready2
select pg_sleep(3);
commit;
SQL
pid=$!
timeout 15 cat "$work/ready2" >/dev/null || { kill "$pid" || true; echo 'second session did not start' >&2; exit 1; }
if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -v home="$home" -v uid="$uid" -v path="$two" >"$work/insert.log" 2>&1 <<SQL
begin;
select set_config('request.jwt.claims','{"sub":"$uid","role":"authenticated"}',true);
set local role authenticated;
insert into public.documents(household_id,created_by,title,mime_type,file_size,storage_path,visibility) values (:'home',:'uid','late','application/pdf',1,:'path','HOUSEHOLD_SHARED');
commit;
SQL
then echo 'concurrent insert accepted a retired path' >&2; exit 1; fi
wait "$pid"
grep -q DOCUMENT_PATH_RETIRED "$work/insert.log"
echo 'Concurrent document cleanup guards passed.'
