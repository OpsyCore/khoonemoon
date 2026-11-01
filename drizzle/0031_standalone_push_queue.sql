-- Independent Web Push queue. It never changes reminder status: Android devices
-- must still be able to discover and schedule the same reminder locally.
create table if not exists public.standalone_push_jobs (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  reminder_version timestamptz not null,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  subscription_version timestamptz not null,
  state text not null default 'PENDING' check (state in ('PENDING','LEASED','SENT','EXPIRED','FAILED')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (reminder_id,reminder_version,subscription_id)
);
create index if not exists standalone_push_pending_idx on public.standalone_push_jobs(next_attempt_at) where state in ('PENDING','LEASED');
alter table public.standalone_push_jobs enable row level security;
revoke all on public.standalone_push_jobs from public,anon,authenticated;

-- Quiet hours are interpreted in the user's profile zone, never in the server
-- zone. Invalid zone or malformed preference fails closed, rather than sending.
create or replace function public.standalone_push_eligible(p_job uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select exists (
    select 1 from public.standalone_push_jobs j
    join public.reminders r on r.id=j.reminder_id
    join public.push_subscriptions s on s.id=j.subscription_id and s.user_id=r.user_id
    join public.notification_preferences p on p.user_id=r.user_id
    join public.profiles u on u.id=r.user_id
    join pg_catalog.pg_timezone_names tz on tz.name=u.timezone
    where j.id=p_job and r.updated_at=j.reminder_version and s.updated_at=j.subscription_version
      and r.status in ('PENDING','SNOOZED') and r.delivered_at is null and s.revoked_at is null
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

create or replace function public.standalone_push_claim(p_limit integer default 25)
returns table(job_id uuid, token uuid, endpoint text, p256dh text, auth text)
language plpgsql security definer set search_path = pg_catalog, public as $$
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

create or replace function public.standalone_push_validate(p_job uuid,p_token uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select exists(select 1 from public.standalone_push_jobs j where j.id=p_job and j.state='LEASED' and j.lease_token=p_token and j.lease_until>now() and public.standalone_push_eligible(j.id));
$$;
revoke all on function public.standalone_push_validate(uuid,uuid) from public,anon,authenticated;
grant execute on function public.standalone_push_validate(uuid,uuid) to service_role;

create or replace function public.standalone_push_finish(p_job uuid,p_token uuid,p_result text)
returns boolean language plpgsql security definer set search_path = pg_catalog, public as $$
declare j public.standalone_push_jobs%rowtype;
begin
  if p_result not in ('sent','expired','retry','stale') or p_result is null then raise exception 'invalid result'; end if;
  select * into j from public.standalone_push_jobs where id=p_job and state='LEASED' and lease_token=p_token and lease_until>now() for update;
  if not found then return false; end if;
  if p_result='expired' then
    update public.push_subscriptions set revoked_at=now() where id=j.subscription_id and updated_at=j.subscription_version and revoked_at is null;
  end if;
  update public.standalone_push_jobs set
    state=case when p_result='sent' then 'SENT' when p_result='expired' then 'EXPIRED' when p_result='stale' or attempts>=8 then 'FAILED' else 'PENDING' end,
    next_attempt_at=case when p_result='retry' then now()+make_interval(secs => least(3600, 30 * (2 ^ least(j.attempts,7))::integer)) else next_attempt_at end,
    finished_at=case when p_result in ('sent','expired','stale') or attempts>=8 then now() else null end,
    lease_token=null,lease_until=null where id=p_job;
  return true;
end $$;
revoke all on function public.standalone_push_finish(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.standalone_push_finish(uuid,uuid,text) to service_role;
