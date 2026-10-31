-- Narrow, revocable background credentials. No account session or refresh token
-- is needed by Android's background worker. Never persist the bearer secret.
create table if not exists public.reminder_devices (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  secret_hash bytea not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.reminder_devices enable row level security;
revoke all on public.reminder_devices from public, anon, authenticated;

-- The app generates a cryptographically random 32-byte secret locally.
create or replace function public.register_reminder_device(p_id uuid, p_secret text)
returns void language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null or p_id is null or p_secret is null or p_secret !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid device registration';
  end if;
  -- Do not allow one account to overwrite another account's device identifier.
  insert into public.reminder_devices(id, user_id, secret_hash, expires_at)
  values (p_id, v_user, sha256(convert_to(p_secret, 'UTF8')), now() + interval '30 days')
  on conflict (id) do update set secret_hash = excluded.secret_hash, expires_at = excluded.expires_at
    where reminder_devices.user_id = v_user;
  if not found then raise exception 'Device registration failed'; end if;
end $$;

create or replace function public.revoke_reminder_device(p_id uuid)
returns void language sql security definer set search_path = pg_catalog, public
as $$ delete from public.reminder_devices where id = p_id and user_id = auth.uid(); $$;

-- Only the minimal scheduling data is returned; never tasks, titles or files.
-- A complete snapshot is required, otherwise the device must retain its old one.
create or replace function public.read_reminder_device(p_id uuid, p_secret text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_user uuid; v_rows jsonb; v_preferences jsonb; v_count bigint;
begin
  if p_id is null or p_secret is null or p_secret !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid device credential' using errcode = '28000';
  end if;
  select user_id into v_user from public.reminder_devices
  where id = p_id and secret_hash = sha256(convert_to(p_secret, 'UTF8')) and expires_at > now();
  if v_user is null then raise exception 'Invalid device credential' using errcode = '28000'; end if;
  select count(*) into v_count from public.reminders
    where user_id = v_user and status in ('PENDING','SNOOZED') and delivered_at is null;
  if v_count > 10000 then raise exception 'Too many reminders'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'at',
    case when status = 'SNOOZED' and snoozed_until is not null then snoozed_until else remind_at end)), '[]'::jsonb)
    into v_rows from public.reminders
    where user_id = v_user and status in ('PENDING','SNOOZED') and delivered_at is null;
  select jsonb_build_object('enabled', in_app_enabled, 'quiet_enabled', quiet_hours_enabled,
    'quiet_start', quiet_hours_start, 'quiet_end', quiet_hours_end)
    into v_preferences from public.notification_preferences where user_id = v_user;
  return jsonb_build_object('reminders', v_rows, 'preferences', v_preferences);
end $$;
revoke all on function public.register_reminder_device(uuid,text) from public, anon;
revoke all on function public.revoke_reminder_device(uuid) from public, anon;
revoke all on function public.read_reminder_device(uuid,text) from public;
grant execute on function public.register_reminder_device(uuid,text) to authenticated;
grant execute on function public.revoke_reminder_device(uuid) to authenticated;
grant execute on function public.read_reminder_device(uuid,text) to anon, authenticated;
