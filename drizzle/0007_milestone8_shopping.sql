-- Milestone 8: Shopping lists + realtime-ready item sync

create extension if not exists pgcrypto;

create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shopping_lists_household_idx
  on public.shopping_lists (household_id, archived_at);

create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists(id) on delete cascade,
  name text not null,
  quantity numeric(12, 3),
  unit text,
  category text,
  note text,
  added_by uuid not null references auth.users(id) on delete cascade,
  purchased boolean not null default false,
  purchased_by uuid references auth.users(id) on delete set null,
  purchased_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shopping_items_list_purchased_idx
  on public.shopping_items (list_id, purchased, position);

-- Helper used by shopping RLS policies (defined here because SQL-language
-- functions are validated at creation time and need the table to exist).
create or replace function public.current_user_can_access_shopping_list(p_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shopping_lists l
    where l.id = p_list_id
      and public.is_household_member(l.household_id)
  );
$$;

drop trigger if exists shopping_lists_set_updated_at on public.shopping_lists;
create trigger shopping_lists_set_updated_at
before update on public.shopping_lists
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists shopping_items_set_updated_at on public.shopping_items;
create trigger shopping_items_set_updated_at
before update on public.shopping_items
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.shopping_lists enable row level security;
alter table public.shopping_items enable row level security;

drop policy if exists "shopping_lists_select_household" on public.shopping_lists;
create policy "shopping_lists_select_household"
on public.shopping_lists
for select
to authenticated
using (public.is_household_member(household_id));

drop policy if exists "shopping_lists_insert_household" on public.shopping_lists;
create policy "shopping_lists_insert_household"
on public.shopping_lists
for insert
to authenticated
with check (created_by = auth.uid() and public.is_household_member(household_id));

drop policy if exists "shopping_lists_update_household" on public.shopping_lists;
create policy "shopping_lists_update_household"
on public.shopping_lists
for update
to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

drop policy if exists "shopping_lists_delete_household" on public.shopping_lists;
create policy "shopping_lists_delete_household"
on public.shopping_lists
for delete
to authenticated
using (public.is_household_member(household_id));

drop policy if exists "shopping_items_select_access" on public.shopping_items;
create policy "shopping_items_select_access"
on public.shopping_items
for select
to authenticated
using (public.current_user_can_access_shopping_list(list_id));

drop policy if exists "shopping_items_insert_access" on public.shopping_items;
create policy "shopping_items_insert_access"
on public.shopping_items
for insert
to authenticated
with check (
  added_by = auth.uid()
  and public.current_user_can_access_shopping_list(list_id)
);

drop policy if exists "shopping_items_update_access" on public.shopping_items;
create policy "shopping_items_update_access"
on public.shopping_items
for update
to authenticated
using (public.current_user_can_access_shopping_list(list_id))
with check (public.current_user_can_access_shopping_list(list_id));

drop policy if exists "shopping_items_delete_access" on public.shopping_items;
create policy "shopping_items_delete_access"
on public.shopping_items
for delete
to authenticated
using (public.current_user_can_access_shopping_list(list_id));

-- Realtime: publish item changes so both partners see updates instantly.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'shopping_items'
    ) then
      alter publication supabase_realtime add table public.shopping_items;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'shopping_lists'
    ) then
      alter publication supabase_realtime add table public.shopping_lists;
    end if;
  end if;
end
$$;

-- Table privileges
grant select, insert, update, delete on public.shopping_lists to authenticated;
grant select, insert, update, delete on public.shopping_items to authenticated;
