-- M9 — Finance & Savings MVP
-- Household-scoped finance data with RLS.

create table if not exists public.finance_goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  name text not null,
  target_amount numeric(14, 2) not null,
  current_amount numeric(14, 2) not null default 0,
  target_date date,
  is_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint finance_goals_name_check
    check (char_length(trim(name)) between 1 and 180),

  constraint finance_goals_target_amount_check
    check (target_amount > 0),

  constraint finance_goals_current_amount_check
    check (current_amount >= 0),

  constraint finance_goals_current_not_over_target_check
    check (current_amount <= target_amount)
);

create index if not exists finance_goals_household_idx
  on public.finance_goals (household_id, created_at desc);

create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  goal_id uuid references public.finance_goals(id) on delete set null,
  amount numeric(14, 2) not null,
  transaction_type text not null,
  description text,
  transaction_date date not null default current_date,
  created_at timestamptz not null default now(),

  constraint finance_transactions_amount_check
    check (amount > 0),

  constraint finance_transactions_type_check
    check (transaction_type in ('INCOME', 'EXPENSE', 'SAVING')),

  constraint finance_transactions_description_check
    check (
      description is null
      or char_length(description) <= 1000
    )
);

create index if not exists finance_transactions_household_date_idx
  on public.finance_transactions (household_id, transaction_date desc);

create index if not exists finance_transactions_goal_idx
  on public.finance_transactions (goal_id);

alter table public.finance_goals enable row level security;
alter table public.finance_transactions enable row level security;

drop policy if exists "finance_goals_select_member"
  on public.finance_goals;

create policy "finance_goals_select_member"
on public.finance_goals
for select
to authenticated
using (
  public.is_household_member(household_id)
);

drop policy if exists "finance_goals_insert_member"
  on public.finance_goals;

create policy "finance_goals_insert_member"
on public.finance_goals
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_household_member(household_id)
);

drop policy if exists "finance_goals_update_member"
  on public.finance_goals;

create policy "finance_goals_update_member"
on public.finance_goals
for update
to authenticated
using (
  public.is_household_member(household_id)
)
with check (
  public.is_household_member(household_id)
);

drop policy if exists "finance_goals_delete_member"
  on public.finance_goals;

create policy "finance_goals_delete_member"
on public.finance_goals
for delete
to authenticated
using (
  public.is_household_member(household_id)
);

drop policy if exists "finance_transactions_select_member"
  on public.finance_transactions;

create policy "finance_transactions_select_member"
on public.finance_transactions
for select
to authenticated
using (
  public.is_household_member(household_id)
);

drop policy if exists "finance_transactions_insert_member"
  on public.finance_transactions;

create policy "finance_transactions_insert_member"
on public.finance_transactions
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_household_member(household_id)
);

drop policy if exists "finance_transactions_update_member"
  on public.finance_transactions;

create policy "finance_transactions_update_member"
on public.finance_transactions
for update
to authenticated
using (
  public.is_household_member(household_id)
)
with check (
  public.is_household_member(household_id)
);

drop policy if exists "finance_transactions_delete_member"
  on public.finance_transactions;

create policy "finance_transactions_delete_member"
on public.finance_transactions
for delete
to authenticated
using (
  public.is_household_member(household_id)
);

revoke all on table public.finance_goals from anon;
revoke all on table public.finance_transactions from anon;

revoke all on table public.finance_goals from authenticated;
revoke all on table public.finance_transactions from authenticated;

grant select, insert, update, delete
  on table public.finance_goals
  to authenticated;

grant select, insert, update, delete
  on table public.finance_transactions
  to authenticated;
