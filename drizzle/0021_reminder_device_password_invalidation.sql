-- A password change invalidates existing device credentials, even if the app
-- did not get a chance to revoke them. Credentials can be re-registered after
-- the user next authenticates. Existing credentials with NULL fingerprints fail
-- closed until re-registered.
alter table public.reminder_devices add column if not exists password_fingerprint bytea;

create or replace function public.register_reminder_device(p_id uuid, p_secret text)
returns void language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_user uuid := auth.uid(); v_password bytea;
begin
  if v_user is null or p_id is null or p_secret is null or p_secret !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid device registration';
  end if;
  select sha256(convert_to(coalesce(encrypted_password, ''), 'UTF8')) into v_password from auth.users where id = v_user;
  if v_password is null then raise exception 'Invalid account'; end if;
  insert into public.reminder_devices(id, user_id, secret_hash, expires_at, password_fingerprint)
  values (p_id, v_user, sha256(convert_to(p_secret, 'UTF8')), now() + interval '30 days', v_password)
  on conflict (id) do update set secret_hash = excluded.secret_hash, expires_at = excluded.expires_at,
    password_fingerprint = excluded.password_fingerprint where reminder_devices.user_id = v_user;
  if not found then raise exception 'Device registration failed'; end if;
end $$;

create or replace function public.read_reminder_device(p_id uuid, p_secret text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_user uuid; v_rows jsonb; v_preferences jsonb; v_count bigint;
begin
  if p_id is null or p_secret is null or p_secret !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid device credential' using errcode = '28000';
  end if;
  select d.user_id into v_user from public.reminder_devices d
  join auth.users u on u.id = d.user_id
  where d.id = p_id and d.secret_hash = sha256(convert_to(p_secret, 'UTF8')) and d.expires_at > now()
    and d.password_fingerprint = sha256(convert_to(coalesce(u.encrypted_password, ''), 'UTF8'));
  if v_user is null then raise exception 'Invalid device credential' using errcode = '28000'; end if;
  select count(*) into v_count from public.reminders
    where user_id = v_user and status in ('PENDING','SNOOZED') and delivered_at is null;
  if v_count > 10000 then raise exception 'Too many reminders'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'at_ms',
    (extract(epoch from (case when status = 'SNOOZED' and snoozed_until is not null then snoozed_until else remind_at end)) * 1000)::bigint)), '[]'::jsonb)
    into v_rows from public.reminders
    where user_id = v_user and status in ('PENDING','SNOOZED') and delivered_at is null;
  select jsonb_build_object('enabled', in_app_enabled, 'quiet_enabled', quiet_hours_enabled,
    'quiet_start', quiet_hours_start, 'quiet_end', quiet_hours_end)
    into v_preferences from public.notification_preferences where user_id = v_user;
  return jsonb_build_object('reminders', v_rows, 'preferences', v_preferences);
end $$;
-- CREATE OR REPLACE preserves the explicit grants from 0019.
