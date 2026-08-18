-- Milestone 4: Tasks + Assignment + Recurrence + RLS

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_visibility') then
    create type public.task_visibility as enum ('PRIVATE', 'HOUSEHOLD_SHARED');
  end if;

  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type public.task_status as enum ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'ARCHIVED');
  end if;

  if not exists (select 1 from pg_type where typname = 'task_priority') then
    create type public.task_priority as enum ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');
  end if;

  if not exists (select 1 from pg_type where typname = 'task_recurrence_frequency') then
    create type public.task_recurrence_frequency as enum (
      'NONE',
      'DAILY',
      'INTERVAL_DAYS',
      'WEEKLY',
      'MONTHLY',
      'YEARLY'
    );
  end if;
end
$$;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  creator_id uuid not null references auth.users(id) on delete restrict,
  owner_id uuid not null references auth.users(id) on delete restrict,
  household_id uuid references public.households(id) on delete cascade,
  visibility public.task_visibility not null default 'PRIVATE',
  status public.task_status not null default 'PENDING',
  priority public.task_priority not null default 'NORMAL',
  due_at timestamptz,
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_visibility_household_check check (
    (visibility = 'PRIVATE' and household_id is null) or
    (visibility = 'HOUSEHOLD_SHARED' and household_id is not null)
  )
);

create index if not exists tasks_owner_status_due_idx
  on public.tasks (owner_id, status, due_at);

create index if not exists tasks_household_visibility_due_idx
  on public.tasks (household_id, visibility, due_at);

create table if not exists public.task_assignees (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  assignee_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(task_id, assignee_id)
);

create index if not exists task_assignees_assignee_idx
  on public.task_assignees (assignee_id);

create table if not exists public.task_recurrences (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  frequency public.task_recurrence_frequency not null default 'NONE',
  interval_days integer,
  weekdays integer[],
  next_occurrence_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(task_id)
);

-- updated_at triggers

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before update on public.tasks
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists task_recurrences_set_updated_at on public.task_recurrences;
create trigger task_recurrences_set_updated_at
before update on public.task_recurrences
for each row
execute function public.set_current_timestamp_updated_at();

-- Security helper functions

create or replace function public.current_user_can_access_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tasks t
    where t.id = p_task_id
      and (
        (t.visibility = 'PRIVATE' and t.owner_id = auth.uid())
        or
        (t.visibility = 'HOUSEHOLD_SHARED' and public.is_household_member(t.household_id))
      )
  );
$$;

create or replace function public.current_user_can_manage_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tasks t
    where t.id = p_task_id
      and (
        (t.visibility = 'PRIVATE' and t.owner_id = auth.uid())
        or
        (t.visibility = 'HOUSEHOLD_SHARED' and public.is_household_member(t.household_id))
      )
  );
$$;

create or replace function public.valid_task_assignee(p_task_id uuid, p_assignee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tasks t
    where t.id = p_task_id
      and (
        (t.visibility = 'PRIVATE' and p_assignee_id = t.owner_id)
        or (
          t.visibility = 'HOUSEHOLD_SHARED'
          and exists (
            select 1
            from public.household_members hm
            where hm.household_id = t.household_id
              and hm.user_id = p_assignee_id
              and hm.left_at is null
          )
        )
      )
  );
$$;

-- RLS
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_recurrences enable row level security;

-- tasks policies

drop policy if exists "tasks_select_access" on public.tasks;
create policy "tasks_select_access"
on public.tasks
for select
to authenticated
using (
  (visibility = 'PRIVATE' and owner_id = auth.uid())
  or
  (visibility = 'HOUSEHOLD_SHARED' and public.is_household_member(household_id))
);

drop policy if exists "tasks_insert_create" on public.tasks;
create policy "tasks_insert_create"
on public.tasks
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

drop policy if exists "tasks_update_manage" on public.tasks;
create policy "tasks_update_manage"
on public.tasks
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

drop policy if exists "tasks_delete_manage" on public.tasks;
create policy "tasks_delete_manage"
on public.tasks
for delete
to authenticated
using (
  (visibility = 'PRIVATE' and owner_id = auth.uid())
  or
  (visibility = 'HOUSEHOLD_SHARED' and public.is_household_member(household_id))
);

-- task_assignees policies

drop policy if exists "task_assignees_select_access" on public.task_assignees;
create policy "task_assignees_select_access"
on public.task_assignees
for select
to authenticated
using (public.current_user_can_access_task(task_id));

drop policy if exists "task_assignees_insert_manage" on public.task_assignees;
create policy "task_assignees_insert_manage"
on public.task_assignees
for insert
to authenticated
with check (
  public.current_user_can_manage_task(task_id)
  and public.valid_task_assignee(task_id, assignee_id)
);

drop policy if exists "task_assignees_delete_manage" on public.task_assignees;
create policy "task_assignees_delete_manage"
on public.task_assignees
for delete
to authenticated
using (public.current_user_can_manage_task(task_id));

-- task_recurrences policies

drop policy if exists "task_recurrences_select_access" on public.task_recurrences;
create policy "task_recurrences_select_access"
on public.task_recurrences
for select
to authenticated
using (public.current_user_can_access_task(task_id));

drop policy if exists "task_recurrences_insert_manage" on public.task_recurrences;
create policy "task_recurrences_insert_manage"
on public.task_recurrences
for insert
to authenticated
with check (public.current_user_can_manage_task(task_id));

drop policy if exists "task_recurrences_update_manage" on public.task_recurrences;
create policy "task_recurrences_update_manage"
on public.task_recurrences
for update
to authenticated
using (public.current_user_can_manage_task(task_id))
with check (public.current_user_can_manage_task(task_id));

drop policy if exists "task_recurrences_delete_manage" on public.task_recurrences;
create policy "task_recurrences_delete_manage"
on public.task_recurrences
for delete
to authenticated
using (public.current_user_can_manage_task(task_id));
