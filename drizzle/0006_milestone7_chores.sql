-- Milestone 7: Chores + rotating assignment + RLS

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'chore_rotation_mode') then
    create type public.chore_rotation_mode as enum ('FIXED', 'ROTATING');
  end if;
end
$$;

create table if not exists public.chores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  description text,
  created_by uuid not null references auth.users(id) on delete restrict,
  rotation_mode public.chore_rotation_mode not null default 'FIXED',
  current_rotation_index integer not null default 0,
  frequency public.task_recurrence_frequency not null default 'WEEKLY',
  interval_days integer,
  weekdays integer[],
  next_due_at timestamptz,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chores_interval_days_check check (
    frequency <> 'INTERVAL_DAYS' or (interval_days is not null and interval_days > 0)
  )
);

create index if not exists chores_household_active_due_idx
  on public.chores (household_id, is_active, next_due_at);

create table if not exists public.chore_rotation_steps (
  id uuid primary key default gen_random_uuid(),
  chore_id uuid not null references public.chores(id) on delete cascade,
  position integer not null,
  assignee_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (chore_id, position)
);

create index if not exists chore_rotation_steps_assignee_idx
  on public.chore_rotation_steps (assignee_id);

create table if not exists public.chore_completions (
  id uuid primary key default gen_random_uuid(),
  chore_id uuid not null references public.chores(id) on delete cascade,
  completed_by uuid not null references auth.users(id) on delete cascade,
  completed_at timestamptz not null default now(),
  due_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists chore_completions_chore_completed_idx
  on public.chore_completions (chore_id, completed_at desc);

drop trigger if exists chores_set_updated_at on public.chores;
create trigger chores_set_updated_at
before update on public.chores
for each row
execute function public.set_current_timestamp_updated_at();

-- Access helpers

create or replace function public.current_user_can_access_chore(p_chore_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chores c
    where c.id = p_chore_id
      and public.is_household_member(c.household_id)
  );
$$;

-- Next due date calculation (kept in SQL so the RPC below stays atomic)

create or replace function public.calculate_next_chore_due(
  p_from timestamptz,
  p_frequency public.task_recurrence_frequency,
  p_interval_days integer,
  p_weekdays integer[]
)
returns timestamptz
language plpgsql
immutable
as $$
declare
  v_base timestamptz := date_trunc('day', coalesce(p_from, now()));
  v_candidate timestamptz;
  v_offset integer;
begin
  case p_frequency
    when 'NONE' then
      return null;
    when 'DAILY' then
      return v_base + interval '1 day';
    when 'INTERVAL_DAYS' then
      return v_base + make_interval(days => greatest(coalesce(p_interval_days, 1), 1));
    when 'MONTHLY' then
      return v_base + interval '1 month';
    when 'YEARLY' then
      return v_base + interval '1 year';
    when 'WEEKLY' then
      if p_weekdays is null or cardinality(p_weekdays) = 0 then
        return v_base + interval '7 days';
      end if;

      for v_offset in 1..14 loop
        v_candidate := v_base + make_interval(days => v_offset);
        if extract(dow from v_candidate)::integer = any (p_weekdays) then
          return v_candidate;
        end if;
      end loop;

      return v_base + interval '7 days';
    else
      return null;
  end case;
end;
$$;

-- Complete a chore: record completion, advance rotation, schedule next due date.

create or replace function public.complete_chore(p_chore_id uuid)
returns table (
  completion_id uuid,
  next_due_at timestamptz,
  next_assignee_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chore public.chores;
  v_step_count integer;
  v_next_index integer;
  v_assignee uuid;
  v_completion_id uuid;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_chore from public.chores where id = p_chore_id for update;

  if v_chore.id is null then
    raise exception 'CHORE_NOT_FOUND';
  end if;

  if not public.is_household_member(v_chore.household_id) then
    raise exception 'NOT_HOUSEHOLD_MEMBER';
  end if;

  insert into public.chore_completions (chore_id, completed_by, due_at)
  values (p_chore_id, auth.uid(), v_chore.next_due_at)
  returning id into v_completion_id;

  select count(*) into v_step_count
  from public.chore_rotation_steps s
  where s.chore_id = p_chore_id;

  if v_chore.rotation_mode = 'ROTATING' and v_step_count > 0 then
    v_next_index := (v_chore.current_rotation_index + 1) % v_step_count;

    select s.assignee_id into v_assignee
    from public.chore_rotation_steps s
    where s.chore_id = p_chore_id and s.position = v_next_index;
  else
    v_next_index := v_chore.current_rotation_index;

    select s.assignee_id into v_assignee
    from public.chore_rotation_steps s
    where s.chore_id = p_chore_id and s.position = 0;
  end if;

  update public.chores
  set current_rotation_index = v_next_index,
      next_due_at = public.calculate_next_chore_due(
        coalesce(v_chore.next_due_at, now()),
        v_chore.frequency,
        v_chore.interval_days,
        v_chore.weekdays
      )
  where id = p_chore_id
  returning next_due_at into v_chore.next_due_at;

  return query select v_completion_id, v_chore.next_due_at, v_assignee;
end;
$$;

-- RLS

alter table public.chores enable row level security;
alter table public.chore_rotation_steps enable row level security;
alter table public.chore_completions enable row level security;

drop policy if exists "chores_select_household" on public.chores;
create policy "chores_select_household"
on public.chores
for select
to authenticated
using (public.is_household_member(household_id));

drop policy if exists "chores_insert_household" on public.chores;
create policy "chores_insert_household"
on public.chores
for insert
to authenticated
with check (created_by = auth.uid() and public.is_household_member(household_id));

drop policy if exists "chores_update_household" on public.chores;
create policy "chores_update_household"
on public.chores
for update
to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

drop policy if exists "chores_delete_household" on public.chores;
create policy "chores_delete_household"
on public.chores
for delete
to authenticated
using (public.is_household_member(household_id));

drop policy if exists "chore_rotation_steps_select_access" on public.chore_rotation_steps;
create policy "chore_rotation_steps_select_access"
on public.chore_rotation_steps
for select
to authenticated
using (public.current_user_can_access_chore(chore_id));

drop policy if exists "chore_rotation_steps_insert_manage" on public.chore_rotation_steps;
create policy "chore_rotation_steps_insert_manage"
on public.chore_rotation_steps
for insert
to authenticated
with check (public.current_user_can_access_chore(chore_id));

drop policy if exists "chore_rotation_steps_delete_manage" on public.chore_rotation_steps;
create policy "chore_rotation_steps_delete_manage"
on public.chore_rotation_steps
for delete
to authenticated
using (public.current_user_can_access_chore(chore_id));

drop policy if exists "chore_completions_select_access" on public.chore_completions;
create policy "chore_completions_select_access"
on public.chore_completions
for select
to authenticated
using (public.current_user_can_access_chore(chore_id));

-- Completions are only written through complete_chore(); direct inserts denied.

-- Table privileges (completions are written only by complete_chore)
grant select, insert, update, delete on public.chores to authenticated;
grant select, insert, delete on public.chore_rotation_steps to authenticated;
grant select on public.chore_completions to authenticated;
