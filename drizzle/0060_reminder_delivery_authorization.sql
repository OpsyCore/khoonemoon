-- Check the recipient's current access at delivery time, not only creation.
-- No arbitrary-user access oracle is granted to application roles.
create or replace function backup_private.reminder_target_authorized(p_user uuid,p_type public.reminder_target_type,p_target uuid,p_house uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public,backup_private,pg_temp as $$
 select case p_type
  when 'TASK' then exists(select 1 from public.tasks t where t.id=p_target and t.household_id is not distinct from p_house and ((t.visibility='PRIVATE' and t.owner_id=p_user) or (t.visibility='HOUSEHOLD_SHARED' and exists(select 1 from public.household_members m where m.household_id=t.household_id and m.user_id=p_user and m.left_at is null))))
  when 'EVENT' then exists(select 1 from public.events e where e.id=p_target and e.household_id is not distinct from p_house and ((e.visibility='PRIVATE' and e.owner_id=p_user) or (e.visibility='HOUSEHOLD_SHARED' and exists(select 1 from public.household_members m where m.household_id=e.household_id and m.user_id=p_user and m.left_at is null))))
  when 'CHORE' then exists(select 1 from public.chores c where c.id=p_target and c.household_id is not distinct from p_house and c.archived_at is null and exists(select 1 from public.household_members m where m.household_id=c.household_id and m.user_id=p_user and m.left_at is null))
  when 'BILL' then exists(select 1 from public.financial_records f where f.id=p_target and f.household_id is not distinct from p_house and f.archived_at is null and f.record_type in ('BILL','SUBSCRIPTION','INSTALLMENT') and ((f.visibility='PRIVATE' and f.owner_id=p_user) or (f.visibility='HOUSEHOLD_SHARED' and exists(select 1 from public.household_members m where m.household_id=f.household_id and m.user_id=p_user and m.left_at is null))))
  else false end;
$$;
revoke all on function backup_private.reminder_target_authorized(uuid,public.reminder_target_type,uuid,uuid) from public,anon,authenticated,service_role;

create or replace function public.standalone_push_eligible(p_job uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public, backup_private, pg_temp as $$
  select exists (
    select 1 from public.standalone_push_jobs j
    join public.reminders r on r.id=j.reminder_id
    join public.push_subscriptions s on s.id=j.subscription_id and s.user_id=r.user_id
    join public.notification_preferences p on p.user_id=r.user_id
    join public.profiles u on u.id=r.user_id
    join pg_catalog.pg_timezone_names tz on tz.name=u.timezone
    where j.id=p_job and r.updated_at=j.reminder_version and s.updated_at=j.subscription_version
      and r.status in ('PENDING','SNOOZED') and r.delivered_at is null and s.revoked_at is null
      and backup_private.reminder_target_authorized(r.user_id,r.target_type,r.target_id,r.household_id)
      and p.web_push_enabled
      and (case when r.status='SNOOZED' then coalesce(r.snoozed_until,r.remind_at) else r.remind_at end) between now()-interval '24 hours' and now()
      and (
        not p.quiet_hours_enabled or (
          p.quiet_hours_start ~ '^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$'
          and p.quiet_hours_end ~ '^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$'
          and (p.quiet_hours_start = p.quiet_hours_end
            or (p.quiet_hours_start < p.quiet_hours_end and (to_char(now() at time zone u.timezone,'HH24:MI') < p.quiet_hours_start or to_char(now() at time zone u.timezone,'HH24:MI') >= p.quiet_hours_end))
            or (p.quiet_hours_start > p.quiet_hours_end and (to_char(now() at time zone u.timezone,'HH24:MI') < p.quiet_hours_start and to_char(now() at time zone u.timezone,'HH24:MI') >= p.quiet_hours_end)))
        )
      )
  );
$$;
revoke all on function public.standalone_push_eligible(uuid) from public,anon,authenticated;

create or replace function public.read_reminder_device(p_id uuid, p_secret text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, backup_private, pg_temp
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
    where user_id = v_user and status in ('PENDING','SNOOZED') and delivered_at is null
      and backup_private.reminder_target_authorized(user_id,target_type,target_id,household_id);
  if v_count > 10000 then raise exception 'Too many reminders'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'at_ms',
    (extract(epoch from (case when status = 'SNOOZED' and snoozed_until is not null then snoozed_until else remind_at end)) * 1000)::bigint)), '[]'::jsonb)
    into v_rows from public.reminders
    where user_id = v_user and status in ('PENDING','SNOOZED') and delivered_at is null
      and backup_private.reminder_target_authorized(user_id,target_type,target_id,household_id);
  select jsonb_build_object('enabled', in_app_enabled, 'quiet_enabled', quiet_hours_enabled,
    'quiet_start', quiet_hours_start, 'quiet_end', quiet_hours_end)
    into v_preferences from public.notification_preferences where user_id = v_user;
  return jsonb_build_object('reminders', v_rows, 'preferences', v_preferences);
end $$;
revoke all on function public.read_reminder_device(uuid,text) from public;
grant execute on function public.read_reminder_device(uuid,text) to anon, authenticated;
-- The current foreground scheduler uses the same filter; listing reminders is
-- unchanged so people can still inspect/cancel inaccessible or orphaned rows.
create or replace function public.mobile_authorized_reminder_schedule()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,backup_private,pg_temp as $$
declare result jsonb; n bigint;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.remind_at,x.id),'[]'::jsonb),count(*) into result,n from (
  select r.* from public.reminders r where r.user_id=auth.uid()
   and r.status in ('PENDING','SNOOZED') and r.delivered_at is null
   and backup_private.reminder_target_authorized(r.user_id,r.target_type,r.target_id,r.household_id)
  order by r.remind_at,r.id limit 10001
 ) x;
 if n>10000 then raise exception 'TOO_MANY_REMINDERS'; end if;
 return result;
end $$;
revoke all on function public.mobile_authorized_reminder_schedule() from public,anon;
grant execute on function public.mobile_authorized_reminder_schedule() to authenticated;

-- Skip unauthorized rows while enqueueing as well, preventing stale rows from starving the queue.
create or replace function public.standalone_push_claim(p_limit integer default 25)
returns table(job_id uuid, token uuid, endpoint text, p256dh text, auth text)
language plpgsql security definer set search_path = pg_catalog, public, backup_private, pg_temp as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 50 then raise exception 'invalid limit'; end if;
  -- Expire old/ineligible leases and keep completed rows for deduplication.
  update public.standalone_push_jobs j set state='FAILED',finished_at=now(),lease_token=null,lease_until=null
    where j.state in ('PENDING','LEASED') and j.created_at < now()-interval '24 hours';
  delete from public.standalone_push_jobs j where j.state in ('SENT','EXPIRED','FAILED') and j.created_at < now()-interval '30 days';
  insert into public.standalone_push_jobs(reminder_id,reminder_version,subscription_id,subscription_version)
  select r.id,r.updated_at,s.id,s.updated_at
  from public.reminders r
  join public.notification_preferences p on p.user_id=r.user_id and p.web_push_enabled
  join public.push_subscriptions s on s.user_id=r.user_id and s.revoked_at is null
  where r.status in ('PENDING','SNOOZED') and r.delivered_at is null
    and backup_private.reminder_target_authorized(r.user_id,r.target_type,r.target_id,r.household_id)
    and (case when r.status='SNOOZED' then coalesce(r.snoozed_until,r.remind_at) else r.remind_at end) between now()-interval '24 hours' and now()
    and length(s.endpoint) <= 2000
    and s.endpoint ~ '^https://(updates\.push\.services\.mozilla\.com|push\.services\.mozilla\.com)/'
    and length(s.p256dh) between 20 and 200 and s.p256dh ~ '^[A-Za-z0-9_-]+$'
    and length(s.auth) between 8 and 100 and s.auth ~ '^[A-Za-z0-9_-]+$'
    and not exists (select 1 from public.standalone_push_jobs j where j.reminder_id=r.id and j.reminder_version=r.updated_at and j.subscription_id=s.id and (j.subscription_version=s.updated_at or j.state <> 'PENDING'))
  order by r.remind_at,r.id,s.id limit 500
  on conflict (reminder_id,reminder_version,subscription_id) do update
    set subscription_version=excluded.subscription_version, next_attempt_at=now(), attempts=0
    where public.standalone_push_jobs.state='PENDING' and public.standalone_push_jobs.subscription_version <> excluded.subscription_version;
  return query
  with candidates as (
    select j.id from public.standalone_push_jobs j
    where (j.state='PENDING' and j.next_attempt_at <= now() or j.state='LEASED' and j.lease_until <= now())
      and public.standalone_push_eligible(j.id)
    order by j.next_attempt_at,j.id for update skip locked limit p_limit
  ), leased as (
    update public.standalone_push_jobs j set state='LEASED', lease_token=gen_random_uuid(), lease_until=now()+interval '2 minutes', attempts=j.attempts+1
    from candidates c where c.id=j.id returning j.id,j.lease_token,j.subscription_id
  )
  select l.id,l.lease_token,s.endpoint,s.p256dh,s.auth from leased l join public.push_subscriptions s on s.id=l.subscription_id;
end $$;
revoke all on function public.standalone_push_claim(integer) from public,anon,authenticated;
grant execute on function public.standalone_push_claim(integer) to service_role;
