-- RLS / grants regression suite.
--
-- Runs against a throwaway Postgres database that has the auth shim plus every
-- migration applied. Any failed expectation raises an exception so the CI job
-- fails loudly.
--
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/local/10_assertions.sql

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- Seed (as the database owner, which bypasses RLS)
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000000a', 'arash@example.test', '{"full_name":"آرش"}'),
  ('00000000-0000-4000-8000-00000000000b', 'sara@example.test', '{"full_name":"سارا"}'),
  ('00000000-0000-4000-8000-00000000000c', 'outsider@example.test', '{"full_name":"غریبه"}')
on conflict (id) do nothing;

insert into public.households (id, name, created_by)
values ('00000000-0000-4000-8000-0000000000f1', 'خانه تست', '00000000-0000-4000-8000-00000000000a')
on conflict (id) do nothing;

insert into public.household_members (household_id, user_id, role) values
  ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-00000000000a', 'OWNER'),
  ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-00000000000b', 'MEMBER')
on conflict do nothing;

insert into public.tasks (title, creator_id, owner_id, household_id, visibility, priority) values
  ('تسک خصوصی آرش', '00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a', null, 'PRIVATE', 'NORMAL'),
  ('تسک خصوصی سارا', '00000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000b', null, 'PRIVATE', 'NORMAL'),
  ('تسک مشترک خانه', '00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000f1', 'HOUSEHOLD_SHARED', 'NORMAL');

insert into public.chores (id, household_id, title, created_by, rotation_mode, frequency, next_due_at) values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000f1', 'شستن ظرف‌ها', '00000000-0000-4000-8000-00000000000a', 'ROTATING', 'WEEKLY', now() - interval '1 day')
on conflict (id) do nothing;

insert into public.chore_rotation_steps (chore_id, position, assignee_id) values
  ('00000000-0000-4000-8000-0000000000c1', 0, '00000000-0000-4000-8000-00000000000a'),
  ('00000000-0000-4000-8000-0000000000c1', 1, '00000000-0000-4000-8000-00000000000b')
on conflict do nothing;

insert into public.shopping_lists (id, household_id, name, created_by) values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000f1', 'خرید هفتگی', '00000000-0000-4000-8000-00000000000a')
on conflict (id) do nothing;

insert into public.shopping_items (list_id, name, added_by) values
  ('00000000-0000-4000-8000-0000000000d1', 'شیر', '00000000-0000-4000-8000-00000000000a');

insert into public.financial_records (
  household_id, owner_id, created_by, visibility, record_type, title, amount, due_at
) values (
  '00000000-0000-4000-8000-0000000000f1',
  '00000000-0000-4000-8000-00000000000a',
  '00000000-0000-4000-8000-00000000000a',
  'HOUSEHOLD_SHARED', 'BILL', 'قبض برق', 500000, now() - interval '2 day'
);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

do $$
declare
  missing text[] := array[]::text[];
begin
  if not has_table_privilege('authenticated', 'public.tasks', 'select') then
    missing := missing || 'tasks:select';
  end if;

  if not has_table_privilege('authenticated', 'public.shopping_items', 'insert') then
    missing := missing || 'shopping_items:insert';
  end if;

  if not has_table_privilege('authenticated', 'public.financial_records', 'update') then
    missing := missing || 'financial_records:update';
  end if;

  if not has_function_privilege('authenticated', 'public.complete_chore(uuid)', 'execute') then
    missing := missing || 'complete_chore:execute';
  end if;

  if not has_function_privilege('authenticated', 'public.search_workspace(text,integer)', 'execute') then
    missing := missing || 'search_workspace:execute';
  end if;

  if has_table_privilege('authenticated', 'public.chore_completions', 'insert') then
    missing := missing || 'chore_completions:insert-must-be-denied';
  end if;

  if has_table_privilege('authenticated', 'public.household_members', 'insert') then
    missing := missing || 'household_members:insert-must-be-denied';
  end if;

  if array_length(missing, 1) is not null then
    raise exception 'GRANT FAIL: %', array_to_string(missing, ', ');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Profiles are created by the auth trigger
-- ---------------------------------------------------------------------------

do $$
begin
  if (select count(*) from public.profiles where id in (
    '00000000-0000-4000-8000-00000000000a',
    '00000000-0000-4000-8000-00000000000b'
  )) <> 2 then
    raise exception 'TRIGGER FAIL: expected 2 profiles created on signup';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Cross-household isolation and private/shared visibility (as Arash)
-- ---------------------------------------------------------------------------

begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-4000-8000-00000000000a', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

do $$
declare
  v_tasks integer;
  v_households integer;
  v_items integer;
  v_finance integer;
  v_chores integer;
  v_search integer;
begin
  select count(*) into v_tasks from public.tasks;
  select count(*) into v_households from public.households;
  select count(*) into v_items from public.shopping_items;
  select count(*) into v_finance from public.financial_records;
  select count(*) into v_chores from public.chores;
  select count(*) into v_search from public.search_workspace('تسک', 20);

  if v_tasks <> 2 then
    raise exception 'RLS FAIL: member should see 2 tasks (private own + shared), saw %', v_tasks;
  end if;

  if exists (select 1 from public.tasks where title = 'تسک خصوصی سارا') then
    raise exception 'RLS FAIL: partner private task leaked to another member';
  end if;

  if v_households <> 1 or v_items <> 1 or v_finance <> 1 or v_chores <> 1 then
    raise exception 'RLS FAIL: household-scoped rows not visible to member (h=%, i=%, f=%, c=%)',
      v_households, v_items, v_finance, v_chores;
  end if;

  if v_search <> 2 then
    raise exception 'SEARCH FAIL: expected 2 hits for member, got %', v_search;
  end if;
end
$$;

commit;

-- ---------------------------------------------------------------------------
-- Outsider sees nothing (even though the data exists)
-- ---------------------------------------------------------------------------

begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-4000-8000-00000000000c', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

do $$
declare
  v_tasks integer;
  v_households integer;
  v_items integer;
  v_finance integer;
  v_search integer;
  v_touched integer;
begin
  select count(*) into v_tasks from public.tasks;
  select count(*) into v_households from public.households;
  select count(*) into v_items from public.shopping_items;
  select count(*) into v_finance from public.financial_records;
  select count(*) into v_search from public.search_workspace('شیر', 20);

  if v_tasks + v_households + v_items + v_finance + v_search <> 0 then
    raise exception 'RLS FAIL: outsider leaked data (t=%, h=%, i=%, f=%, s=%)',
      v_tasks, v_households, v_items, v_finance, v_search;
  end if;

  update public.shopping_items set purchased = true where name = 'شیر';
  get diagnostics v_touched = row_count;

  if v_touched <> 0 then
    raise exception 'RLS FAIL: outsider modified % shopping items', v_touched;
  end if;
end
$$;

commit;

-- ---------------------------------------------------------------------------
-- Chore rotation advances atomically for a household member
-- ---------------------------------------------------------------------------

begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-4000-8000-00000000000b', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

do $$
declare
  v_next_due timestamptz;
  v_assignee uuid;
  v_index integer;
begin
  select next_due_at, next_assignee_id into v_next_due, v_assignee
  from public.complete_chore('00000000-0000-4000-8000-0000000000c1');

  select current_rotation_index into v_index
  from public.chores where id = '00000000-0000-4000-8000-0000000000c1';

  if v_index <> 1 then
    raise exception 'CHORE FAIL: rotation index should advance to 1, got %', v_index;
  end if;

  if v_next_due is null or v_next_due <= now() then
    raise exception 'CHORE FAIL: next due date was not rescheduled into the future (%)', v_next_due;
  end if;

  if v_assignee <> '00000000-0000-4000-8000-00000000000b' then
    raise exception 'CHORE FAIL: rotation picked the wrong assignee (%)', v_assignee;
  end if;

  if (select count(*) from public.chore_completions) <> 1 then
    raise exception 'CHORE FAIL: completion was not recorded';
  end if;
end
$$;

commit;

-- ---------------------------------------------------------------------------
-- Bill status is derived from the due date
-- ---------------------------------------------------------------------------

do $$
declare
  v_status public.bill_status;
begin
  select bill_status into v_status from public.financial_records where title = 'قبض برق';

  if v_status <> 'OVERDUE' then
    raise exception 'BILL FAIL: expected OVERDUE for a past due bill, got %', v_status;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Data-shape constraints
-- ---------------------------------------------------------------------------

do $$
begin
  begin
    insert into public.financial_records (
      household_id, owner_id, created_by, visibility, record_type, title, amount
    ) values (
      '00000000-0000-4000-8000-0000000000f1',
      '00000000-0000-4000-8000-00000000000a',
      '00000000-0000-4000-8000-00000000000a',
      'PRIVATE', 'EXPENSE', 'نباید ثبت شود', 1000
    );

    raise exception 'CONSTRAINT FAIL: PRIVATE record accepted a household_id';
  exception
    when check_violation then
      null; -- expected
  end;

  begin
    insert into public.tasks (
      title, creator_id, owner_id, visibility
    ) values (
      'تسک مشترک بدون خانه',
      '00000000-0000-4000-8000-00000000000a',
      '00000000-0000-4000-8000-00000000000a',
      'HOUSEHOLD_SHARED'
    );

    raise exception 'CONSTRAINT FAIL: shared task accepted without household_id';
  exception
    when check_violation then
      null; -- expected
  end;
end
$$;

\echo 'All RLS / grant / integrity assertions passed.'
