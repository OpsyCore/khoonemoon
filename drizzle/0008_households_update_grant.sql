-- 0008_households_update_grant.sql
-- Fix: 0007 only granted SELECT on public.households.
-- Rename household (PATCH /api/household) needs UPDATE privilege.
-- RLS policy "households_update_owner" already exists from 0002.
-- Also harden immutable columns on households.

-- 1) Table privilege required by PostgREST direct update
grant select, update on table public.households to authenticated;

-- Keep members/invitations read-only at table level (mutations stay on RPCs)
grant select on table public.household_members to authenticated;
grant select on table public.household_invitations to authenticated;

-- 2) Prevent owners from rewriting ownership/audit fields via UPDATE
create or replace function public.protect_household_immutable_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id then
      raise exception 'HOUSEHOLD_ID_IMMUTABLE';
    end if;

    if new.created_by is distinct from old.created_by then
      raise exception 'HOUSEHOLD_CREATED_BY_IMMUTABLE';
    end if;

    if new.created_at is distinct from old.created_at then
      raise exception 'HOUSEHOLD_CREATED_AT_IMMUTABLE';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_household_immutable_fields on public.households;
create trigger protect_household_immutable_fields
before update on public.households
for each row
execute function public.protect_household_immutable_fields();

-- 3) Re-assert owner update policy (idempotent; same meaning as 0002)
drop policy if exists "households_update_owner" on public.households;
create policy "households_update_owner"
on public.households
for update
to authenticated
using (public.is_household_owner(id))
with check (public.is_household_owner(id));
