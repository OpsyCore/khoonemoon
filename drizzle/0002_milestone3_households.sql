-- Milestone 3: Household + Membership + Invitations + RLS

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'member_role') then
    create type public.member_role as enum ('OWNER', 'MEMBER');
  end if;

  if not exists (select 1 from pg_type where typname = 'invitation_status') then
    create type public.invitation_status as enum ('PENDING', 'ACCEPTED', 'CANCELED', 'EXPIRED');
  end if;
end
$$;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'MEMBER',
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists household_members_household_user_active_uniq
  on public.household_members (household_id, user_id)
  where left_at is null;

create unique index if not exists household_members_user_active_single_household_uniq
  on public.household_members (user_id)
  where left_at is null;

create index if not exists household_members_household_idx
  on public.household_members (household_id);

create table if not exists public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete restrict,
  invite_code_hash text not null unique,
  status public.invitation_status not null default 'PENDING',
  expires_at timestamptz not null,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists household_invitations_household_status_idx
  on public.household_invitations (household_id, status);

-- updated_at triggers

drop trigger if exists households_set_updated_at on public.households;
create trigger households_set_updated_at
before update on public.households
for each row
execute function public.set_current_timestamp_updated_at();

-- Helper functions for auth-aware checks

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = auth.uid()
      and hm.left_at is null
  );
$$;

create or replace function public.is_household_owner(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = auth.uid()
      and hm.left_at is null
      and hm.role = 'OWNER'
  );
$$;

-- RPC: create household and owner membership atomically
create or replace function public.create_household(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
  v_has_active_household boolean;
begin
  if v_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  select exists (
    select 1
    from public.household_members hm
    where hm.user_id = v_user_id
      and hm.left_at is null
  ) into v_has_active_household;

  if v_has_active_household then
    raise exception 'ALREADY_IN_HOUSEHOLD';
  end if;

  insert into public.households (name, created_by)
  values (trim(p_name), v_user_id)
  returning id into v_household_id;

  insert into public.household_members (household_id, user_id, role)
  values (v_household_id, v_user_id, 'OWNER');

  return v_household_id;
end;
$$;

-- RPC: create invitation code (owner only)
create or replace function public.create_household_invitation(
  p_code_hash text,
  p_expires_at timestamptz
)
returns public.household_invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
  v_invitation public.household_invitations;
begin
  if v_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  select hm.household_id
  into v_household_id
  from public.household_members hm
  where hm.user_id = v_user_id
    and hm.left_at is null
    and hm.role = 'OWNER'
  limit 1;

  if v_household_id is null then
    raise exception 'ONLY_OWNER_CAN_INVITE';
  end if;

  insert into public.household_invitations (
    household_id,
    invited_by,
    invite_code_hash,
    expires_at,
    status
  )
  values (
    v_household_id,
    v_user_id,
    p_code_hash,
    p_expires_at,
    'PENDING'
  )
  returning * into v_invitation;

  return v_invitation;
end;
$$;

-- RPC: join household using invitation code hash
create or replace function public.join_household_with_invitation(p_code_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_invitation public.household_invitations;
  v_has_active_household boolean;
begin
  if v_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  select exists (
    select 1 from public.household_members hm
    where hm.user_id = v_user_id
      and hm.left_at is null
  ) into v_has_active_household;

  if v_has_active_household then
    raise exception 'ALREADY_IN_HOUSEHOLD';
  end if;

  select *
  into v_invitation
  from public.household_invitations hi
  where hi.invite_code_hash = p_code_hash
  limit 1;

  if v_invitation.id is null then
    raise exception 'INVITATION_NOT_FOUND';
  end if;

  if v_invitation.status <> 'PENDING' then
    raise exception 'INVITATION_NOT_PENDING';
  end if;

  if v_invitation.expires_at <= now() then
    update public.household_invitations
    set status = 'EXPIRED'
    where id = v_invitation.id;

    raise exception 'INVITATION_EXPIRED';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (v_invitation.household_id, v_user_id, 'MEMBER');

  update public.household_invitations
  set status = 'ACCEPTED',
      accepted_by = v_user_id,
      accepted_at = now()
  where id = v_invitation.id
    and status = 'PENDING';

  return v_invitation.household_id;
end;
$$;

-- RPC: cancel pending invitation (owner only)
create or replace function public.cancel_household_invitation(p_invitation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
begin
  if v_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  select hm.household_id
  into v_household_id
  from public.household_members hm
  where hm.user_id = v_user_id
    and hm.left_at is null
    and hm.role = 'OWNER'
  limit 1;

  if v_household_id is null then
    raise exception 'ONLY_OWNER_CAN_CANCEL_INVITE';
  end if;

  update public.household_invitations hi
  set status = 'CANCELED',
      canceled_at = now()
  where hi.id = p_invitation_id
    and hi.household_id = v_household_id
    and hi.status = 'PENDING';

  return found;
end;
$$;

-- RPC: leave current household
create or replace function public.leave_current_household()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
  v_role public.member_role;
  v_active_members_count integer;
begin
  if v_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  select hm.household_id, hm.role
  into v_household_id, v_role
  from public.household_members hm
  where hm.user_id = v_user_id
    and hm.left_at is null
  limit 1;

  if v_household_id is null then
    raise exception 'NOT_IN_HOUSEHOLD';
  end if;

  select count(*)::int
  into v_active_members_count
  from public.household_members hm
  where hm.household_id = v_household_id
    and hm.left_at is null;

  if v_role = 'OWNER' and v_active_members_count > 1 then
    raise exception 'OWNER_CANNOT_LEAVE_WITH_ACTIVE_MEMBERS';
  end if;

  update public.household_members
  set left_at = now()
  where user_id = v_user_id
    and household_id = v_household_id
    and left_at is null;

  return found;
end;
$$;

-- RLS
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invitations enable row level security;

-- Households policies

drop policy if exists "households_select_member" on public.households;
create policy "households_select_member"
on public.households
for select
to authenticated
using (public.is_household_member(id));

drop policy if exists "households_insert_creator" on public.households;
create policy "households_insert_creator"
on public.households
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "households_update_owner" on public.households;
create policy "households_update_owner"
on public.households
for update
to authenticated
using (public.is_household_owner(id))
with check (public.is_household_owner(id));

-- Household members policies

drop policy if exists "household_members_select_same_household" on public.household_members;
create policy "household_members_select_same_household"
on public.household_members
for select
to authenticated
using (public.is_household_member(household_id));

-- Intentionally no insert/update/delete policy for direct membership changes.
-- Membership mutations are only allowed through controlled RPC functions above.

-- Invitations policies

drop policy if exists "household_invitations_select_member" on public.household_invitations;
create policy "household_invitations_select_member"
on public.household_invitations
for select
to authenticated
using (public.is_household_member(household_id));

-- Intentionally no direct insert/update/delete policy for invitation mutation.
-- Mutations are through RPC functions that enforce owner and status checks.

grant execute on function public.create_household(text) to authenticated;
grant execute on function public.create_household_invitation(text, timestamptz) to authenticated;
grant execute on function public.join_household_with_invitation(text) to authenticated;
grant execute on function public.cancel_household_invitation(uuid) to authenticated;
grant execute on function public.leave_current_household() to authenticated;
