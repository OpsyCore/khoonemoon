-- Milestone 9: Finance Lite (bills + one-off expenses)
-- Single table, PRIVATE | HOUSEHOLD_SHARED, no stored bill status.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'finance_record_type') then
    create type public.finance_record_type as enum ('EXPENSE', 'BILL');
  end if;

  if not exists (select 1 from pg_type where typname = 'finance_visibility') then
    create type public.finance_visibility as enum ('PRIVATE', 'HOUSEHOLD_SHARED');
  end if;
end
$$;

create table if not exists public.finance_records (
  id uuid primary key default gen_random_uuid(),
  record_type public.finance_record_type not null,
  title text not null,
  amount numeric(14, 2) not null,
  currency text not null default 'IRR',
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  household_id uuid references public.households(id) on delete cascade,
  visibility public.finance_visibility not null default 'PRIVATE',
  due_at timestamptz,
  occurred_at timestamptz,
  paid_at timestamptz,
  paid_by uuid references auth.users(id) on delete set null,
  category text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint finance_records_visibility_household_check check (
    (visibility = 'PRIVATE' and household_id is null)
    or
    (visibility = 'HOUSEHOLD_SHARED' and household_id is not null)
  ),

  constraint finance_records_title_check
    check (char_length(trim(title)) between 1 and 180),

  constraint finance_records_amount_check
    check (amount > 0),

  constraint finance_records_currency_check
    check (char_length(trim(currency)) between 3 and 8),

  constraint finance_records_category_check
    check (category is null or char_length(category) between 1 and 80),

  constraint finance_records_note_check
    check (note is null or char_length(note) <= 1000),

  constraint finance_records_type_fields_check check (
    (
      record_type = 'BILL'
      and due_at is not null
      and occurred_at is null
    )
    or
    (
      record_type = 'EXPENSE'
      and occurred_at is not null
      and due_at is null
      and paid_at is null
      and paid_by is null
    )
  ),

  constraint finance_records_paid_pair_check check (
    (paid_at is null and paid_by is null)
    or
    (paid_at is not null and paid_by is not null)
  )
);

create index if not exists finance_records_owner_type_due_idx
  on public.finance_records (owner_id, record_type, due_at);

create index if not exists finance_records_household_visibility_due_idx
  on public.finance_records (household_id, visibility, due_at);

create index if not exists finance_records_unpaid_bills_due_idx
  on public.finance_records (due_at)
  where record_type = 'BILL' and paid_at is null;

create index if not exists finance_records_paid_by_idx
  on public.finance_records (paid_by)
  where paid_by is not null;

drop trigger if exists finance_records_set_updated_at on public.finance_records;
create trigger finance_records_set_updated_at
before update on public.finance_records
for each row
execute function public.set_current_timestamp_updated_at();

create or replace function public.protect_finance_record_immutable_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
     or new.record_type is distinct from old.record_type
     or new.owner_id is distinct from old.owner_id
     or new.created_by is distinct from old.created_by
     or new.household_id is distinct from old.household_id
     or new.visibility is distinct from old.visibility
     or new.created_at is distinct from old.created_at then
    raise exception 'FINANCE_RECORD_IMMUTABLE_FIELDS';
  end if;

  return new;
end;
$$;

drop trigger if exists finance_records_protect_immutable on public.finance_records;
create trigger finance_records_protect_immutable
before update on public.finance_records
for each row
execute function public.protect_finance_record_immutable_fields();

create or replace function public.valid_finance_paid_by(
  p_visibility public.finance_visibility,
  p_owner_id uuid,
  p_household_id uuid,
  p_paid_by uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_paid_by is null
    or (
      p_visibility = 'PRIVATE'
      and p_paid_by = p_owner_id
    )
    or (
      p_visibility = 'HOUSEHOLD_SHARED'
      and p_household_id is not null
      and exists (
        select 1
        from public.household_members hm
        where hm.household_id = p_household_id
          and hm.user_id = p_paid_by
          and hm.left_at is null
      )
    );
$$;

create or replace function public.current_user_can_access_finance_record(
  p_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.finance_records r
    where r.id = p_id
      and (
        (r.visibility = 'PRIVATE' and r.owner_id = auth.uid())
        or
        (
          r.visibility = 'HOUSEHOLD_SHARED'
          and public.is_household_member(r.household_id)
        )
      )
  );
$$;

alter table public.finance_records enable row level security;

drop policy if exists "finance_records_select_access" on public.finance_records;
create policy "finance_records_select_access"
on public.finance_records
for select
to authenticated
using (
  (visibility = 'PRIVATE' and owner_id = auth.uid())
  or
  (visibility = 'HOUSEHOLD_SHARED' and public.is_household_member(household_id))
);

drop policy if exists "finance_records_insert_create" on public.finance_records;
create policy "finance_records_insert_create"
on public.finance_records
for insert
to authenticated
with check (
  created_by = auth.uid()
  and owner_id = auth.uid()
  and (
    (visibility = 'PRIVATE' and household_id is null)
    or
    (
      visibility = 'HOUSEHOLD_SHARED'
      and household_id is not null
      and public.is_household_member(household_id)
    )
  )
  and public.valid_finance_paid_by(
    visibility,
    owner_id,
    household_id,
    paid_by
  )
);

drop policy if exists "finance_records_update_manage" on public.finance_records;
create policy "finance_records_update_manage"
on public.finance_records
for update
to authenticated
using (
  (visibility = 'PRIVATE' and owner_id = auth.uid())
  or
  (visibility = 'HOUSEHOLD_SHARED' and public.is_household_member(household_id))
)
with check (
  (
    (visibility = 'PRIVATE' and owner_id = auth.uid() and household_id is null)
    or
    (
      visibility = 'HOUSEHOLD_SHARED'
      and household_id is not null
      and public.is_household_member(household_id)
    )
  )
  and public.valid_finance_paid_by(
    visibility,
    owner_id,
    household_id,
    paid_by
  )
);

drop policy if exists "finance_records_delete_manage" on public.finance_records;
create policy "finance_records_delete_manage"
on public.finance_records
for delete
to authenticated
using (
  (visibility = 'PRIVATE' and owner_id = auth.uid())
  or
  (visibility = 'HOUSEHOLD_SHARED' and public.is_household_member(household_id))
);

create or replace function public.create_finance_record(
  p_record_type public.finance_record_type,
  p_title text,
  p_amount numeric,
  p_currency text,
  p_visibility public.finance_visibility,
  p_due_at timestamptz,
  p_occurred_at timestamptz,
  p_category text,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
  v_id uuid;
  v_title text := trim(coalesce(p_title, ''));
  v_currency text := coalesce(nullif(trim(coalesce(p_currency, '')), ''), 'IRR');
  v_category text := nullif(trim(coalesce(p_category, '')), '');
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_due_at timestamptz := p_due_at;
  v_occurred_at timestamptz := p_occurred_at;
begin
  if v_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  if v_title = '' then
    raise exception 'INVALID_FINANCE_TITLE';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_FINANCE_AMOUNT';
  end if;

  if p_visibility = 'HOUSEHOLD_SHARED' then
    select hm.household_id
    into v_household_id
    from public.household_members hm
    where hm.user_id = v_user_id
      and hm.left_at is null
    limit 1;

    if v_household_id is null then
      raise exception 'NO_HOUSEHOLD_FOR_SHARED_FINANCE';
    end if;
  else
    v_household_id := null;
  end if;

  if p_record_type = 'BILL' then
    v_occurred_at := null;
    if v_due_at is null then
      raise exception 'INVALID_BILL_DUE_AT';
    end if;
  elsif p_record_type = 'EXPENSE' then
    v_due_at := null;
    if v_occurred_at is null then
      raise exception 'INVALID_EXPENSE_OCCURRED_AT';
    end if;
  else
    raise exception 'INVALID_FINANCE_RECORD_TYPE';
  end if;

  insert into public.finance_records (
    record_type,
    title,
    amount,
    currency,
    owner_id,
    created_by,
    household_id,
    visibility,
    due_at,
    occurred_at,
    paid_at,
    paid_by,
    category,
    note
  )
  values (
    p_record_type,
    v_title,
    p_amount,
    v_currency,
    v_user_id,
    v_user_id,
    v_household_id,
    p_visibility,
    v_due_at,
    v_occurred_at,
    null,
    null,
    v_category,
    v_note
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.update_finance_record(
  p_id uuid,
  p_title text,
  p_amount numeric,
  p_currency text,
  p_due_at timestamptz,
  p_occurred_at timestamptz,
  p_category text,
  p_note text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_record public.finance_records;
  v_title text := trim(coalesce(p_title, ''));
  v_currency text := coalesce(nullif(trim(coalesce(p_currency, '')), ''), 'IRR');
  v_category text := nullif(trim(coalesce(p_category, '')), '');
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_due_at timestamptz := p_due_at;
  v_occurred_at timestamptz := p_occurred_at;
begin
  if v_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  select *
  into v_record
  from public.finance_records r
  where r.id = p_id;

  if v_record.id is null then
    raise exception 'FINANCE_NOT_FOUND';
  end if;

  if not public.current_user_can_access_finance_record(p_id) then
    raise exception 'FINANCE_ACCESS_DENIED';
  end if;

  if v_title = '' then
    raise exception 'INVALID_FINANCE_TITLE';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_FINANCE_AMOUNT';
  end if;

  if v_record.record_type = 'BILL' then
    v_occurred_at := null;
    if v_due_at is null then
      raise exception 'INVALID_BILL_DUE_AT';
    end if;
  else
    v_due_at := null;
    if v_occurred_at is null then
      raise exception 'INVALID_EXPENSE_OCCURRED_AT';
    end if;
  end if;

  update public.finance_records
  set
    title = v_title,
    amount = p_amount,
    currency = v_currency,
    due_at = v_due_at,
    occurred_at = v_occurred_at,
    category = v_category,
    note = v_note
  where id = p_id;

  return true;
end;
$$;

create or replace function public.set_finance_record_paid(
  p_id uuid,
  p_paid boolean,
  p_paid_by uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_record public.finance_records;
  v_paid_by uuid;
begin
  if v_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  select *
  into v_record
  from public.finance_records r
  where r.id = p_id;

  if v_record.id is null then
    raise exception 'FINANCE_NOT_FOUND';
  end if;

  if not public.current_user_can_access_finance_record(p_id) then
    raise exception 'FINANCE_ACCESS_DENIED';
  end if;

  if v_record.record_type <> 'BILL' then
    raise exception 'FINANCE_NOT_A_BILL';
  end if;

  if p_paid then
    v_paid_by := coalesce(p_paid_by, v_user_id);

    if not public.valid_finance_paid_by(
      v_record.visibility,
      v_record.owner_id,
      v_record.household_id,
      v_paid_by
    ) then
      raise exception 'INVALID_FINANCE_PAID_BY';
    end if;

    update public.finance_records
    set
      paid_at = now(),
      paid_by = v_paid_by
    where id = p_id;
  else
    update public.finance_records
    set
      paid_at = null,
      paid_by = null
    where id = p_id;
  end if;

  return true;
end;
$$;

revoke all on table public.finance_records from anon;
revoke all on table public.finance_records from authenticated;
grant select, insert, update, delete
  on table public.finance_records
  to authenticated;

revoke all on function public.protect_finance_record_immutable_fields() from public;

revoke all on function public.valid_finance_paid_by(
  public.finance_visibility,
  uuid,
  uuid,
  uuid
) from public;
grant execute on function public.valid_finance_paid_by(
  public.finance_visibility,
  uuid,
  uuid,
  uuid
) to authenticated;

revoke all on function public.current_user_can_access_finance_record(uuid) from public;

revoke all on function public.create_finance_record(
  public.finance_record_type,
  text,
  numeric,
  text,
  public.finance_visibility,
  timestamptz,
  timestamptz,
  text,
  text
) from public;
revoke all on function public.create_finance_record(
  public.finance_record_type,
  text,
  numeric,
  text,
  public.finance_visibility,
  timestamptz,
  timestamptz,
  text,
  text
) from anon;
grant execute on function public.create_finance_record(
  public.finance_record_type,
  text,
  numeric,
  text,
  public.finance_visibility,
  timestamptz,
  timestamptz,
  text,
  text
) to authenticated;

revoke all on function public.update_finance_record(
  uuid,
  text,
  numeric,
  text,
  timestamptz,
  timestamptz,
  text,
  text
) from public;
revoke all on function public.update_finance_record(
  uuid,
  text,
  numeric,
  text,
  timestamptz,
  timestamptz,
  text,
  text
) from anon;
grant execute on function public.update_finance_record(
  uuid,
  text,
  numeric,
  text,
  timestamptz,
  timestamptz,
  text,
  text
) to authenticated;

revoke all on function public.set_finance_record_paid(
  uuid,
  boolean,
  uuid
) from public;
revoke all on function public.set_finance_record_paid(
  uuid,
  boolean,
  uuid
) from anon;
grant execute on function public.set_finance_record_paid(
  uuid,
  boolean,
  uuid
) to authenticated;
