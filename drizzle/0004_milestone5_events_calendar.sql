-- Milestone 5: Calendar events + RLS

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'event_visibility') then
    create type public.event_visibility as enum ('PRIVATE', 'HOUSEHOLD_SHARED');
  end if;
end
$$;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  creator_id uuid not null references auth.users(id) on delete restrict,
  owner_id uuid not null references auth.users(id) on delete restrict,
  household_id uuid references public.households(id) on delete cascade,
  visibility public.event_visibility not null default 'PRIVATE',
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_visibility_household_check check (
    (visibility = 'PRIVATE' and household_id is null) or
    (visibility = 'HOUSEHOLD_SHARED' and household_id is not null)
  ),
  constraint events_time_order_check check (end_at > start_at)
);

create index if not exists events_household_start_idx
  on public.events (household_id, start_at);

create index if not exists events_owner_start_idx
  on public.events (owner_id, start_at);

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
before update on public.events
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.events enable row level security;

drop policy if exists "events_select_access" on public.events;
create policy "events_select_access"
on public.events
for select
to authenticated
using (
  (visibility = 'PRIVATE' and owner_id = auth.uid())
  or
  (visibility = 'HOUSEHOLD_SHARED' and public.is_household_member(household_id))
);

drop policy if exists "events_insert_create" on public.events;
create policy "events_insert_create"
on public.events
for insert
to authenticated
with check (
  creator_id = auth.uid()
  and owner_id = auth.uid()
  and (
    (visibility = 'PRIVATE' and household_id is null)
    or
    (visibility = 'HOUSEHOLD_SHARED' and household_id is not null and public.is_household_member(household_id))
  )
);

drop policy if exists "events_update_manage" on public.events;
create policy "events_update_manage"
on public.events
for update
to authenticated
using (
  (visibility = 'PRIVATE' and owner_id = auth.uid())
  or
  (visibility = 'HOUSEHOLD_SHARED' and public.is_household_member(household_id))
)
with check (
  (visibility = 'PRIVATE' and owner_id = auth.uid() and household_id is null)
  or
  (visibility = 'HOUSEHOLD_SHARED' and household_id is not null and public.is_household_member(household_id))
);

drop policy if exists "events_delete_manage" on public.events;
create policy "events_delete_manage"
on public.events
for delete
to authenticated
using (
  (visibility = 'PRIVATE' and owner_id = auth.uid())
  or
  (visibility = 'HOUSEHOLD_SHARED' and public.is_household_member(household_id))
);
