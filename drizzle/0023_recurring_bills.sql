-- Recurring bills produce one successor when marked paid, atomically. Legacy
-- flags with no supported rule remain unchanged and do not create records.
alter table public.financial_records add column if not exists recurrence_timezone text;
create table if not exists public.finance_recurrence_instances (
  paid_record_id uuid primary key references public.financial_records(id) on delete cascade,
  next_record_id uuid not null unique references public.financial_records(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (paid_record_id <> next_record_id)
);
alter table public.finance_recurrence_instances enable row level security;
drop policy if exists finance_recurrence_read on public.finance_recurrence_instances;
create policy finance_recurrence_read on public.finance_recurrence_instances for select to authenticated using (
  exists(select 1 from public.financial_records f where f.id=paid_record_id)
);
revoke all on public.finance_recurrence_instances from public, anon, authenticated;
grant select on public.finance_recurrence_instances to authenticated;

create or replace function public.advance_paid_recurring_bill() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare next_id uuid; next_due timestamptz; uid uuid := auth.uid();
begin
  if old.paid_at is not null or new.paid_at is null or not new.is_recurring
    or new.recurrence_rule not in ('DAILY','WEEKLY','MONTHLY','YEARLY')
    or new.recurrence_rule is null or new.record_type not in ('BILL','SUBSCRIPTION','INSTALLMENT') then return new; end if;
  if uid is null or new.paid_by is distinct from uid or new.archived_at is not null
    or (new.visibility='PRIVATE' and new.owner_id<>uid)
    or (new.visibility='HOUSEHOLD_SHARED' and not public.is_household_member(new.household_id)) then
    raise exception 'RECURRING_BILL_FORBIDDEN';
  end if;
  if new.due_at is null or new.recurrence_timezone is null then raise exception 'RECURRING_BILL_MISSING_SCHEDULE'; end if;
  if exists(select 1 from public.finance_recurrence_instances where paid_record_id=new.id) then return new; end if;
  next_due := public.next_zoned_recurrence(new.due_at,new.recurrence_rule::public.task_recurrence_frequency,null,null,new.recurrence_timezone);
  if next_due is null or next_due <= new.due_at then raise exception 'INVALID_RECURRING_BILL'; end if;
  insert into public.financial_records(household_id,owner_id,created_by,visibility,record_type,title,amount,currency,category,note,occurred_at,due_at,is_recurring,recurrence_rule,recurrence_timezone)
  values(new.household_id,new.owner_id,new.created_by,new.visibility,new.record_type,new.title,new.amount,new.currency,new.category,new.note,next_due,next_due,true,new.recurrence_rule,new.recurrence_timezone)
  returning id into next_id;
  insert into public.finance_recurrence_instances(paid_record_id,next_record_id) values(new.id,next_id);
  return new;
end $$;
revoke all on function public.advance_paid_recurring_bill() from public, anon, authenticated;
drop trigger if exists advance_paid_recurring_bill on public.financial_records;
create trigger advance_paid_recurring_bill after update of paid_at on public.financial_records for each row execute function public.advance_paid_recurring_bill();

-- Prevent undo after a successor exists: the chain must not represent the same
-- installment twice. The user can archive a record instead.
create or replace function public.guard_recurring_bill_undo() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
  if old.paid_at is not null and new.paid_at is null and exists(select 1 from public.finance_recurrence_instances where paid_record_id=old.id) then
    raise exception 'RECURRING_BILL_CANNOT_UNDO';
  end if;
  return new;
end $$;
revoke all on function public.guard_recurring_bill_undo() from public, anon, authenticated;
drop trigger if exists guard_recurring_bill_undo on public.financial_records;
create trigger guard_recurring_bill_undo before update of paid_at on public.financial_records for each row execute function public.guard_recurring_bill_undo();
