#!/usr/bin/env bash
# Two independent database sessions, disposable CI database only.
set -euo pipefail
: "${DATABASE_URL:?}"
if [[ ! "$DATABASE_URL" =~ ^postgres(ql)?://[^/]+@(127\.0\.0\.1|localhost)(:[0-9]+)?/khoonemoon_check$ ]]; then
  echo 'refusing invitation concurrency test outside disposable database' >&2; exit 1
fi
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-4000-8000-00000000000e','invite-e@example.test','{}'),
 ('00000000-0000-4000-8000-00000000000f','invite-f@example.test','{}') on conflict do nothing;
SQL
# Identical creator retries must yield one row, including overlapping requests.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q >"$tmp/create1" 2>&1 <<'SQL' &
begin;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);
select (public.create_household_invitation_retry(repeat('a',64),'2099-01-01Z')).id;
select pg_sleep(2);
commit;
SQL
pid=$!
# Existing expiry needs to be within 168 hours, so create with a shared fixed
# expiry resolved by the database instead of a timestamp far in the future.
if wait "$pid"; then echo 'invalid expiry unexpectedly accepted'; exit 1; fi
expiry=$(psql "$DATABASE_URL" -Atq -c "select to_char(now()+interval '24 hours','YYYY-MM-DD\"T\"HH24:MI:SS.USOF')")
for n in 1 2; do
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q >"$tmp/create$n" 2>&1 <<SQL &
begin;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);
select (public.create_household_invitation_retry(repeat('a',64),'$expiry')).id;
select pg_sleep(1);
commit;
SQL
pids[$n]=$!
done
wait "${pids[1]}"; wait "${pids[2]}"
count=$(psql "$DATABASE_URL" -Atq -c "select count(*) from public.household_invitations where invite_code_hash=repeat('a',64)")
[[ "$count" == 1 ]]
# Two different accounts racing the same code: only one may join.
for pair in 'e 1' 'f 2'; do
  read -r u n <<<"$pair"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q >"$tmp/join$n" 2>&1 <<SQL &
begin;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000000$u","role":"authenticated"}',true);
select public.join_household_with_invitation(repeat('a',64));
select pg_sleep(1);
commit;
SQL
  pids[$n]=$!
done
ok=0
for n in 1 2; do if wait "${pids[$n]}"; then ok=$((ok+1)); fi; done
[[ "$ok" == 1 ]] || { echo 'one-time invitation race failed'; exit 1; }
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
do $$
declare uid uuid; hid uuid; n int;
begin
 select accepted_by,household_id into uid,hid from public.household_invitations where invite_code_hash=repeat('a',64);
 select count(*) into n from public.household_members where user_id in ('00000000-0000-4000-8000-00000000000e','00000000-0000-4000-8000-00000000000f') and left_at is null;
 if n <> 1 then raise exception 'invite produced % memberships',n; end if;
 perform set_config('request.jwt.claims',json_build_object('sub',uid,'role','authenticated')::text,true);
 if public.join_household_with_invitation(repeat('a',64)) <> hid then raise exception 'retry did not return original house'; end if;
 update public.household_members set left_at=now() where user_id=uid and household_id=hid and left_at is null;
 begin
   perform public.join_household_with_invitation(repeat('a',64));
   raise exception 'left member was reactivated';
 exception when raise_exception then
   if sqlerrm <> 'INVITATION_NOT_PENDING' then raise; end if;
 end;
end $$;
SQL
echo 'invitation retry and one-time-use race passed'
