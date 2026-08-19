-- Milestone 7: Household Chores + Recurrence + Rotation + Completions + RLS

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'chore_recurrence_frequency'
  ) then
    create type public.chore_recurrence_frequency as enum (
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

-- =========================================================
-- Chores
-- =========================================================

create table if not exists public.chores (
  id uuid primary key default gen_random_uuid(),

  household_id uuid not null
    references public.households(id)
    on delete cascade,

  created_by uuid not null
    references auth.users(id)
    on delete restrict,

  default_assignee_id uuid
    references auth.users(id)
    on delete set null,

  title text not null,
  description text,

  is_active boolean not null default true,

  start_date date not null default current_date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chores_title_not_blank
    check (char_length(trim(title)) > 0)
);

create index if not exists chores_household_active_idx
  on public.chores (household_id, is_active);

create index if not exists chores_default_assignee_idx
  on public.chores (default_assignee_id);

-- =========================================================
-- Chore recurrence
-- =========================================================

create table if not exists public.chore_recurrences (
  id uuid primary key default gen_random_uuid(),

  chore_id uuid not null
    references public.chores(id)
    on delete cascade,

  frequency public.chore_recurrence_frequency
    not null
    default 'NONE',

  interval_days integer,

  weekdays integer[],

  next_occurrence_date date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chore_recurrences_chore_uniq
    unique (chore_id),

  constraint chore_recurrences_interval_days_check
    check (
      interval_days is null
      or interval_days > 0
    ),

  constraint chore_recurrences_weekdays_check
    check (
      weekdays is null
      or weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::integer[]
    )
);

-- =========================================================
-- Chore rotation
-- =========================================================

create table if not exists public.chore_rotations (
  id uuid primary key default gen_random_uuid(),

  chore_id uuid not null
    references public.chores(id)
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  position integer not null,

  created_at timestamptz not null default now(),

  constraint chore_rotations_position_check
    check (position >= 0),

  constraint chore_rotations_chore_user_uniq
    unique (chore_id, user_id),

  constraint chore_rotations_chore_position_uniq
    unique (chore_id, position)
);

create index if not exists chore_rotations_chore_position_idx
  on public.chore_rotations (chore_id, position);

create index if not exists chore_rotations_user_idx
  on public.chore_rotations (user_id);

-- =========================================================
-- Chore completions
-- =========================================================

create table if not exists public.chore_completions (
  id uuid primary key default gen_random_uuid(),

  chore_id uuid not null
    references public.chores(id)
    on delete cascade,

  for_date date not null,

  assigned_to uuid
    references auth.users(id)
    on delete set null,

  completed_by uuid not null
    references auth.users(id)
    on delete restrict,

  completed_at timestamptz not null default now(),

  created_at timestamptz not null default now(),

  constraint chore_completions_chore_date_uniq
    unique (chore_id, for_date)
);

create index if not exists chore_completions_chore_date_idx
  on public.chore_completions (chore_id, for_date);

create index if not exists chore_completions_assigned_to_date_idx
  on public.chore_completions (assigned_to, for_date);

-- =========================================================
-- updated_at triggers
-- =========================================================

drop trigger if exists chores_set_updated_at
on public.chores;

create trigger chores_set_updated_at
before update on public.chores
for each row
execute function public.set_current_timestamp_updated_at();


drop trigger if exists chore_recurrences_set_updated_at
on public.chore_recurrences;

create trigger chore_recurrences_set_updated_at
before update on public.chore_recurrences
for each row
execute function public.set_current_timestamp_updated_at();

-- =========================================================
-- Security helper functions
-- =========================================================

create or replace function public.current_user_can_access_chore(
  p_chore_id uuid
)
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


create or replace function public.current_user_can_manage_chore(
  p_chore_id uuid
)
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


create or replace function public.valid_chore_member(
  p_chore_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chores c
    join public.household_members hm
      on hm.household_id = c.household_id
    where c.id = p_chore_id
      and hm.user_id = p_user_id
      and hm.left_at is null
  );
$$;


create or replace function public.valid_chore_default_assignee(
  p_household_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_user_id is null
    or exists (
      select 1
      from public.household_members hm
      where hm.household_id = p_household_id
        and hm.user_id = p_user_id
        and hm.left_at is null
    );
$$;

-- =========================================================
-- Enable RLS
-- =========================================================

alter table public.chores
  enable row level security;

alter table public.chore_recurrences
  enable row level security;

alter table public.chore_rotations
  enable row level security;

alter table public.chore_completions
  enable row level security;

-- =========================================================
-- chores policies
-- =========================================================

drop policy if exists "chores_select_household"
on public.chores;

create policy "chores_select_household"
on public.chores
for select
to authenticated
using (
  public.is_household_member(household_id)
);


drop policy if exists "chores_insert_household"
on public.chores;

create policy "chores_insert_household"
on public.chores
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_household_member(household_id)
  and public.valid_chore_default_assignee(
    household_id,
    default_assignee_id
  )
);


drop policy if exists "chores_update_household"
on public.chores;

create policy "chores_update_household"
on public.chores
for update
to authenticated
using (
  public.is_household_member(household_id)
)
with check (
  public.is_household_member(household_id)
  and public.valid_chore_default_assignee(
    household_id,
    default_assignee_id
  )
);


drop policy if exists "chores_delete_household"
on public.chores;

create policy "chores_delete_household"
on public.chores
for delete
to authenticated
using (
  public.is_household_member(household_id)
);

-- =========================================================
-- recurrence policies
-- =========================================================

drop policy if exists "chore_recurrences_select_access"
on public.chore_recurrences;

create policy "chore_recurrences_select_access"
on public.chore_recurrences
for select
to authenticated
using (
  public.current_user_can_access_chore(chore_id)
);


drop policy if exists "chore_recurrences_insert_manage"
on public.chore_recurrences;

create policy "chore_recurrences_insert_manage"
on public.chore_recurrences
for insert
to authenticated
with check (
  public.current_user_can_manage_chore(chore_id)
);


drop policy if exists "chore_recurrences_update_manage"
on public.chore_recurrences;

create policy "chore_recurrences_update_manage"
on public.chore_recurrences
for update
to authenticated
using (
  public.current_user_can_manage_chore(chore_id)
)
with check (
  public.current_user_can_manage_chore(chore_id)
);


drop policy if exists "chore_recurrences_delete_manage"
on public.chore_recurrences;

create policy "chore_recurrences_delete_manage"
on public.chore_recurrences
for delete
to authenticated
using (
  public.current_user_can_manage_chore(chore_id)
);

-- =========================================================
-- rotation policies
-- =========================================================

drop policy if exists "chore_rotations_select_access"
on public.chore_rotations;

create policy "chore_rotations_select_access"
on public.chore_rotations
for select
to authenticated
using (
  public.current_user_can_access_chore(chore_id)
);


drop policy if exists "chore_rotations_insert_manage"
on public.chore_rotations;

create policy "chore_rotations_insert_manage"
on public.chore_rotations
for insert
to authenticated
with check (
  public.current_user_can_manage_chore(chore_id)
  and public.valid_chore_member(chore_id, user_id)
);


drop policy if exists "chore_rotations_update_manage"
on public.chore_rotations;

create policy "chore_rotations_update_manage"
on public.chore_rotations
for update
to authenticated
using (
  public.current_user_can_manage_chore(chore_id)
)
with check (
  public.current_user_can_manage_chore(chore_id)
  and public.valid_chore_member(chore_id, user_id)
);


drop policy if exists "chore_rotations_delete_manage"
on public.chore_rotations;

create policy "chore_rotations_delete_manage"
on public.chore_rotations
for delete
to authenticated
using (
  public.current_user_can_manage_chore(chore_id)
);

-- =========================================================
-- completion policies
-- =========================================================

drop policy if exists "chore_completions_select_access"
on public.chore_completions;

create policy "chore_completions_select_access"
on public.chore_completions
for select
to authenticated
using (
  public.current_user_can_access_chore(chore_id)
);


drop policy if exists "chore_completions_insert_access"
on public.chore_completions;

create policy "chore_completions_insert_access"
on public.chore_completions
for insert
to authenticated
with check (
  completed_by = auth.uid()
  and public.current_user_can_manage_chore(chore_id)
  and (
    assigned_to is null
    or public.valid_chore_member(chore_id, assigned_to)
  )
);


drop policy if exists "chore_completions_update_access"
on public.chore_completions;

create policy "chore_completions_update_access"
on public.chore_completions
for update
to authenticated
using (
  public.current_user_can_manage_chore(chore_id)
)
with check (
  public.current_user_can_manage_chore(chore_id)
  and (
    assigned_to is null
    or public.valid_chore_member(chore_id, assigned_to)
  )
);


drop policy if exists "chore_completions_delete_access"
on public.chore_completions;

create policy "chore_completions_delete_access"
on public.chore_completions
for delete
to authenticated
using (
  public.current_user_can_manage_chore(chore_id)
);

-- =========================================================
-- Immutable ownership fields
-- Prevent moving a chore to another household or changing
-- its original creator after creation.
-- =========================================================

create or replace function public.protect_chore_ownership_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.household_id is distinct from old.household_id then
    raise exception 'CHORE_HOUSEHOLD_IMMUTABLE';
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception 'CHORE_CREATOR_IMMUTABLE';
  end if;

  return new;
end;
$$;

drop trigger if exists chores_protect_ownership_fields
on public.chores;

create trigger chores_protect_ownership_fields
before update on public.chores
for each row
execute function public.protect_chore_ownership_fields();



-- =========================================================
-- Atomic Chore creation RPC
-- =========================================================

create or replace function public.create_chore(
  p_title text,
  p_description text,
  p_start_date date,
  p_default_assignee_id uuid,
  p_frequency public.chore_recurrence_frequency,
  p_interval_days integer,
  p_weekdays integer[],
  p_rotation_user_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
  v_chore_id uuid;
  v_rotation_user_id uuid;
  v_position integer := 0;
begin
  if v_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  select hm.household_id
  into v_household_id
  from public.household_members hm
  where hm.user_id = v_user_id
    and hm.left_at is null
  limit 1;

  if v_household_id is null then
    raise exception 'NO_HOUSEHOLD_FOR_CHORE';
  end if;

  if trim(coalesce(p_title, '')) = '' then
    raise exception 'INVALID_CHORE_TITLE';
  end if;

  if p_default_assignee_id is not null
     and not exists (
       select 1
       from public.household_members hm
       where hm.household_id = v_household_id
         and hm.user_id = p_default_assignee_id
         and hm.left_at is null
     ) then
    raise exception 'INVALID_DEFAULT_ASSIGNEE';
  end if;

  if p_frequency = 'INTERVAL_DAYS'
     and (p_interval_days is null or p_interval_days <= 0) then
    raise exception 'INVALID_INTERVAL_DAYS';
  end if;

  if p_frequency = 'WEEKLY'
     and coalesce(array_length(p_weekdays, 1), 0) = 0 then
    raise exception 'WEEKDAYS_REQUIRED';
  end if;

  if p_weekdays is not null
     and not (
       p_weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::integer[]
     ) then
    raise exception 'INVALID_WEEKDAYS';
  end if;

  if p_rotation_user_ids is not null then
    if (
      select count(*)
      from unnest(p_rotation_user_ids) value
    ) <> (
      select count(distinct value)
      from unnest(p_rotation_user_ids) value
    ) then
      raise exception 'DUPLICATE_ROTATION_MEMBER';
    end if;

    if exists (
      select 1
      from unnest(p_rotation_user_ids) rotation_user_id
      where not exists (
        select 1
        from public.household_members hm
        where hm.household_id = v_household_id
          and hm.user_id = rotation_user_id
          and hm.left_at is null
      )
    ) then
      raise exception 'INVALID_ROTATION_MEMBER';
    end if;
  end if;

  insert into public.chores (
    household_id,
    created_by,
    default_assignee_id,
    title,
    description,
    start_date
  )
  values (
    v_household_id,
    v_user_id,
    p_default_assignee_id,
    trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''),
    p_start_date
  )
  returning id into v_chore_id;

  insert into public.chore_recurrences (
    chore_id,
    frequency,
    interval_days,
    weekdays
  )
  values (
    v_chore_id,
    p_frequency,
    p_interval_days,
    p_weekdays
  );

  if p_rotation_user_ids is not null then
    foreach v_rotation_user_id in array p_rotation_user_ids
    loop
      insert into public.chore_rotations (
        chore_id,
        user_id,
        position
      )
      values (
        v_chore_id,
        v_rotation_user_id,
        v_position
      );

      v_position := v_position + 1;
    end loop;
  end if;

  return v_chore_id;
end;
$$;

revoke all on function public.create_chore(
  text,
  text,
  date,
  uuid,
  public.chore_recurrence_frequency,
  integer,
  integer[],
  uuid[]
) from public;

grant execute on function public.create_chore(
  text,
  text,
  date,
  uuid,
  public.chore_recurrence_frequency,
  integer,
  integer[],
  uuid[]
) to authenticated;
