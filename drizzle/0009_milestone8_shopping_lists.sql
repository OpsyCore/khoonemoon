-- M8 — Shared Shopping Lists (MVP)
-- Household-scoped lists/items with RLS.

create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint shopping_lists_name_check
    check (char_length(trim(name)) between 1 and 120)
);

create index if not exists shopping_lists_household_active_idx
  on public.shopping_lists (household_id, is_active, created_at desc);


create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  name text not null,
  quantity numeric(10, 2),
  unit text,
  note text,
  is_checked boolean not null default false,
  checked_by uuid references auth.users(id) on delete set null,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint shopping_items_name_check
    check (char_length(trim(name)) between 1 and 180),

  constraint shopping_items_quantity_check
    check (quantity is null or quantity > 0),

  constraint shopping_items_unit_check
    check (unit is null or char_length(trim(unit)) between 1 and 40),

  constraint shopping_items_note_check
    check (note is null or char_length(note) <= 1000),

  constraint shopping_items_checked_state_check
    check (
      (is_checked = false and checked_by is null and checked_at is null)
      or
      (is_checked = true and checked_by is not null and checked_at is not null)
    )
);

create index if not exists shopping_items_list_checked_idx
  on public.shopping_items (list_id, is_checked, created_at desc);


-- updated_at helper kept local to shopping to avoid depending on
-- naming/details of older migrations.
create or replace function public.set_shopping_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists shopping_lists_set_updated_at
  on public.shopping_lists;

create trigger shopping_lists_set_updated_at
before update on public.shopping_lists
for each row
execute function public.set_shopping_updated_at();

drop trigger if exists shopping_items_set_updated_at
  on public.shopping_items;

create trigger shopping_items_set_updated_at
before update on public.shopping_items
for each row
execute function public.set_shopping_updated_at();


-- Prevent callers from forging ownership/creator metadata during UPDATE.
create or replace function public.protect_shopping_list_immutable_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
     or new.household_id is distinct from old.household_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'SHOPPING_LIST_IMMUTABLE_FIELDS';
  end if;

  return new;
end;
$$;

drop trigger if exists shopping_lists_protect_immutable
  on public.shopping_lists;

create trigger shopping_lists_protect_immutable
before update on public.shopping_lists
for each row
execute function public.protect_shopping_list_immutable_fields();


create or replace function public.protect_shopping_item_immutable_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
     or new.list_id is distinct from old.list_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'SHOPPING_ITEM_IMMUTABLE_FIELDS';
  end if;

  return new;
end;
$$;

drop trigger if exists shopping_items_protect_immutable
  on public.shopping_items;

create trigger shopping_items_protect_immutable
before update on public.shopping_items
for each row
execute function public.protect_shopping_item_immutable_fields();


alter table public.shopping_lists enable row level security;
alter table public.shopping_items enable row level security;


-- Lists: every active household member may read/write lists in that household.
drop policy if exists "shopping_lists_select_member"
  on public.shopping_lists;
create policy "shopping_lists_select_member"
on public.shopping_lists
for select
to authenticated
using (
  public.is_household_member(household_id)
);

drop policy if exists "shopping_lists_insert_member"
  on public.shopping_lists;
create policy "shopping_lists_insert_member"
on public.shopping_lists
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_household_member(household_id)
);

drop policy if exists "shopping_lists_update_member"
  on public.shopping_lists;
create policy "shopping_lists_update_member"
on public.shopping_lists
for update
to authenticated
using (
  public.is_household_member(household_id)
)
with check (
  public.is_household_member(household_id)
);

drop policy if exists "shopping_lists_delete_member"
  on public.shopping_lists;
create policy "shopping_lists_delete_member"
on public.shopping_lists
for delete
to authenticated
using (
  public.is_household_member(household_id)
);


-- Items inherit access from their parent list's household.
drop policy if exists "shopping_items_select_member"
  on public.shopping_items;
create policy "shopping_items_select_member"
on public.shopping_items
for select
to authenticated
using (
  exists (
    select 1
    from public.shopping_lists l
    where l.id = shopping_items.list_id
      and public.is_household_member(l.household_id)
  )
);

drop policy if exists "shopping_items_insert_member"
  on public.shopping_items;
create policy "shopping_items_insert_member"
on public.shopping_items
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.shopping_lists l
    where l.id = shopping_items.list_id
      and l.is_active = true
      and public.is_household_member(l.household_id)
  )
);

drop policy if exists "shopping_items_update_member"
  on public.shopping_items;
create policy "shopping_items_update_member"
on public.shopping_items
for update
to authenticated
using (
  exists (
    select 1
    from public.shopping_lists l
    where l.id = shopping_items.list_id
      and public.is_household_member(l.household_id)
  )
)
with check (
  exists (
    select 1
    from public.shopping_lists l
    where l.id = shopping_items.list_id
      and public.is_household_member(l.household_id)
  )
);

drop policy if exists "shopping_items_delete_member"
  on public.shopping_items;
create policy "shopping_items_delete_member"
on public.shopping_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.shopping_lists l
    where l.id = shopping_items.list_id
      and public.is_household_member(l.household_id)
  )
);


-- Table privileges are required in addition to RLS.
revoke all on table public.shopping_lists from anon;
revoke all on table public.shopping_items from anon;

revoke all on table public.shopping_lists from authenticated;
revoke all on table public.shopping_items from authenticated;

grant select, insert, update, delete
  on table public.shopping_lists
  to authenticated;

grant select, insert, update, delete
  on table public.shopping_items
  to authenticated;


-- Trigger helper functions are not application RPC endpoints.
revoke all on function public.set_shopping_updated_at() from public;
revoke all on function public.protect_shopping_list_immutable_fields() from public;
revoke all on function public.protect_shopping_item_immutable_fields() from public;
