-- Transactional idempotency for task/chore creation. Existing create routines
-- remain SECURITY INVOKER so all their RLS and membership checks still apply.
create table if not exists public.mobile_create_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  kind text not null check (kind in ('task', 'chore')),
  input_hash text not null check (length(input_hash) = 64),
  result_id uuid,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);
alter table public.mobile_create_requests enable row level security;
revoke all on public.mobile_create_requests from public, anon;
grant select, insert, update on public.mobile_create_requests to authenticated;
drop policy if exists mobile_requests_select on public.mobile_create_requests;
create policy mobile_requests_select on public.mobile_create_requests for select to authenticated using (user_id = auth.uid());
drop policy if exists mobile_requests_insert on public.mobile_create_requests;
create policy mobile_requests_insert on public.mobile_create_requests for insert to authenticated with check (user_id = auth.uid());
drop policy if exists mobile_requests_update on public.mobile_create_requests;
create policy mobile_requests_update on public.mobile_create_requests for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.mobile_create_once(p_request_id uuid, p_kind text, p_input jsonb)
returns uuid language plpgsql security invoker set search_path = pg_catalog, public, pg_temp as $$
declare
  uid uuid := auth.uid();
  digest text;
  receipt public.mobile_create_requests%rowtype;
  created uuid;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_request_id is null or p_kind not in ('task','chore') or p_kind is null or jsonb_typeof(p_input) is distinct from 'object' or octet_length(p_input::text) > 32768 then
    raise exception 'INVALID_REQUEST';
  end if;
  digest := encode(sha256(convert_to(p_input::text, 'UTF8')), 'hex');
  -- The unique key serializes concurrent retries until the first transaction
  -- commits/rolls back. The receipt and created row commit together.
  insert into public.mobile_create_requests(user_id, request_id, kind, input_hash)
  values(uid, p_request_id, p_kind, digest) on conflict(user_id, request_id) do nothing;
  select * into receipt from public.mobile_create_requests
    where user_id = uid and request_id = p_request_id for update;
  if receipt.kind is distinct from p_kind or receipt.input_hash is distinct from digest then
    raise exception 'REQUEST_ID_REUSED_WITH_DIFFERENT_INPUT';
  end if;
  if receipt.result_id is not null then return receipt.result_id; end if;
  if p_kind = 'task' then created := public.mobile_create_task(p_input);
  else created := public.mobile_create_chore(p_input); end if;
  update public.mobile_create_requests set result_id = created where user_id = uid and request_id = p_request_id;
  return created;
end $$;
revoke all on function public.mobile_create_once(uuid,text,jsonb) from public, anon;
grant execute on function public.mobile_create_once(uuid,text,jsonb) to authenticated;
