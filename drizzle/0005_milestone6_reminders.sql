-- Milestone 6: Reminder engine foundation

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'reminder_target_type') then
    create type public.reminder_target_type as enum ('TASK', 'EVENT');
  end if;

  if not exists (select 1 from pg_type where typname = 'reminder_status') then
    create type public.reminder_status as enum ('PENDING', 'SNOOZED', 'SENT', 'CANCELED');
  end if;
end
$$;

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  target_type public.reminder_target_type not null,
  target_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,
  remind_at timestamptz not null,
  status public.reminder_status not null default 'PENDING',
  snoozed_until timestamptz,
  snooze_count integer not null default 0,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reminders_user_status_remind_idx
  on public.reminders (user_id, status, remind_at);

create index if not exists reminders_target_idx
  on public.reminders (target_type, target_id);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  in_app_enabled boolean not null default true,
  web_push_enabled boolean not null default false,
  quiet_hours_enabled boolean not null default false,
  quiet_hours_start text,
  quiet_hours_end text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

drop trigger if exists reminders_set_updated_at on public.reminders;
create trigger reminders_set_updated_at
before update on public.reminders
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists notification_preferences_set_updated_at on public.notification_preferences;
create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row
execute function public.set_current_timestamp_updated_at();

create or replace function public.current_user_can_access_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and (
        (e.visibility = 'PRIVATE' and e.owner_id = auth.uid())
        or
        (e.visibility = 'HOUSEHOLD_SHARED' and public.is_household_member(e.household_id))
      )
  );
$$;

create or replace function public.current_user_can_create_reminder(
  p_target_type public.reminder_target_type,
  p_target_id uuid,
  p_household_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_target_type = 'TASK' then
    return public.current_user_can_access_task(p_target_id);
  end if;

  if p_target_type = 'EVENT' then
    return public.current_user_can_access_event(p_target_id);
  end if;

  return false;
end;
$$;

alter table public.reminders enable row level security;
alter table public.notification_preferences enable row level security;

drop policy if exists "reminders_select_own" on public.reminders;
create policy "reminders_select_own"
on public.reminders
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "reminders_insert_own" on public.reminders;
create policy "reminders_insert_own"
on public.reminders
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.current_user_can_create_reminder(target_type, target_id, household_id)
);

drop policy if exists "reminders_update_own" on public.reminders;
create policy "reminders_update_own"
on public.reminders
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "reminders_delete_own" on public.reminders;
create policy "reminders_delete_own"
on public.reminders
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "notification_preferences_select_own" on public.notification_preferences;
create policy "notification_preferences_select_own"
on public.notification_preferences
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "notification_preferences_insert_own" on public.notification_preferences;
create policy "notification_preferences_insert_own"
on public.notification_preferences
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "notification_preferences_update_own" on public.notification_preferences;
create policy "notification_preferences_update_own"
on public.notification_preferences
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
