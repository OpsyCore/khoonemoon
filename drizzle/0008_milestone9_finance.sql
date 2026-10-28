-- Milestone 9: Finance lite (bills, expenses, due/overdue states)

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'visibility_type') then
    create type public.visibility_type as enum ('PRIVATE', 'HOUSEHOLD_SHARED');
  end if;

  if not exists (select 1 from pg_type where typname = 'financial_record_type') then
    create type public.financial_record_type as enum (
      'EXPENSE',
      'INCOME',
      'BILL',
      'SUBSCRIPTION',
      'INSTALLMENT',
      'DEBT'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'bill_status') then
    create type public.bill_status as enum ('UPCOMING', 'DUE', 'PAID', 'OVERDUE');
  end if;
end
$$;

create table if not exists public.financial_records (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  visibility public.visibility_type not null default 'PRIVATE',
  record_type public.financial_record_type not null default 'EXPENSE',
  title text not null,
  amount numeric(14, 2) not null,
  currency text not null default 'IRR',
  category text,
  note text,
  occurred_at timestamptz not null default now(),
  due_at timestamptz,
  bill_status public.bill_status,
  is_recurring boolean not null default false,
  recurrence_rule text,
  paid_by uuid references auth.users(id) on delete set null,
  paid_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_records_visibility_household_check check (
    (visibility = 'PRIVATE' and household_id is null and owner_id = created_by)
    or (visibility = 'HOUSEHOLD_SHARED' and household_id is not null)
  ),
  constraint financial_records_amount_positive_check check (amount >= 0),
  constraint financial_records_bill_status_check check (
    record_type in ('BILL', 'SUBSCRIPTION', 'INSTALLMENT') or bill_status is null
  )
);

create index if not exists financial_records_household_due_idx
  on public.financial_records (household_id, due_at, bill_status);

create index if not exists financial_records_owner_occurred_idx
  on public.financial_records (owner_id, occurred_at desc);

drop trigger if exists financial_records_set_updated_at on public.financial_records;
create trigger financial_records_set_updated_at
before update on public.financial_records
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.financial_records enable row level security;

drop policy if exists "financial_records_select_access" on public.financial_records;
create policy "financial_records_select_access"
on public.financial_records
for select
to authenticated
using (
  (visibility = 'PRIVATE' and owner_id = auth.uid())
  or (visibility = 'HOUSEHOLD_SHARED' and public.is_household_member(household_id))
);

drop policy if exists "financial_records_insert_access" on public.financial_records;
create policy "financial_records_insert_access"
on public.financial_records
for insert
to authenticated
with check (
  created_by = auth.uid()
  and (
    (visibility = 'PRIVATE' and owner_id = auth.uid() and household_id is null)
    or (
      visibility = 'HOUSEHOLD_SHARED'
      and household_id is not null
      and public.is_household_member(household_id)
    )
  )
);

drop policy if exists "financial_records_update_access" on public.financial_records;
create policy "financial_records_update_access"
on public.financial_records
for update
to authenticated
using (
  (visibility = 'PRIVATE' and owner_id = auth.uid())
  or (visibility = 'HOUSEHOLD_SHARED' and public.is_household_member(household_id))
)
with check (
  (visibility = 'PRIVATE' and owner_id = auth.uid() and household_id is null)
  or (visibility = 'HOUSEHOLD_SHARED' and public.is_household_member(household_id))
);

drop policy if exists "financial_records_delete_access" on public.financial_records;
create policy "financial_records_delete_access"
on public.financial_records
for delete
to authenticated
using (
  (visibility = 'PRIVATE' and owner_id = auth.uid())
  or (visibility = 'HOUSEHOLD_SHARED' and public.is_household_member(household_id))
);

-- Keep bill_status in sync with due dates.
create or replace function public.sync_financial_record_due_status()
returns trigger
language plpgsql
as $$
begin
  if new.record_type in ('BILL', 'SUBSCRIPTION', 'INSTALLMENT') then
    if new.paid_at is not null then
      new.bill_status := 'PAID';
    elsif new.due_at is null then
      new.bill_status := coalesce(new.bill_status, 'UPCOMING');
    elsif new.due_at < now() then
      new.bill_status := 'OVERDUE';
    elsif new.due_at < now() + interval '3 days' then
      new.bill_status := 'DUE';
    else
      new.bill_status := 'UPCOMING';
    end if;
  else
    new.bill_status := null;
  end if;

  return new;
end;
$$;

drop trigger if exists financial_records_sync_due_status on public.financial_records;
create trigger financial_records_sync_due_status
before insert or update on public.financial_records
for each row
execute function public.sync_financial_record_due_status();

-- Table privileges
grant select, insert, update, delete on public.financial_records to authenticated;
