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
  id, household_id, owner_id, created_by, visibility, record_type, title, amount, due_at
) values (
  '00000000-0000-4000-8000-0000000000f2',
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

  if not has_table_privilege('authenticated', 'public.push_subscriptions', 'insert') then
    missing := missing || 'push_subscriptions:insert';
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
-- Push subscriptions are private to their owner
-- ---------------------------------------------------------------------------

insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
values (
  '00000000-0000-4000-8000-00000000000a',
  'https://push.example.test/device-a',
  repeat('p', 40),
  repeat('a', 20)
);

begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-4000-8000-00000000000b', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

do $$
declare
  v_visible integer;
begin
  select count(*) into v_visible from public.push_subscriptions;

  if v_visible <> 0 then
    raise exception 'RLS FAIL: partner can see % push subscriptions of another user', v_visible;
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

-- Documents and the storage bucket must share the same privacy boundary.
insert into public.documents (id, household_id, created_by, title, mime_type, file_size, storage_path, visibility)
values
  ('00000000-0000-4000-8000-0000000000e1', null, '00000000-0000-4000-8000-00000000000a', 'private', 'application/pdf', 10, 'user/00000000-0000-4000-8000-00000000000a/doc/file.pdf', 'PRIVATE'),
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-00000000000a', 'shared', 'application/pdf', 10, 'household/00000000-0000-4000-8000-0000000000f1/doc/file.pdf', 'HOUSEHOLD_SHARED');
insert into storage.objects (bucket_id, name) values
  ('documents', 'user/00000000-0000-4000-8000-00000000000a/doc/file.pdf'),
  ('documents', 'household/00000000-0000-4000-8000-0000000000f1/doc/file.pdf');
insert into public.document_attachments (document_id, entity_type, entity_id, created_by)
select '00000000-0000-4000-8000-0000000000e2', 'FINANCE_RECORD', id, '00000000-0000-4000-8000-00000000000a'
from public.financial_records where title = 'قبض برق';

do $$
begin
  if has_function_privilege('anon', 'public.current_user_can_access_document_entity(public.document_entity_type,uuid)', 'execute') then
    raise exception 'DOC FAIL: anon can execute entity access function';
  end if;
end $$;

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.documents) <> 1 then
    raise exception 'DOC FAIL: partner should see shared but not private document';
  end if;
  if (select count(*) from storage.objects) <> 1 then
    raise exception 'DOC FAIL: partner should see only shared file';
  end if;
  if (select count(*) from public.document_attachments) <> 1 then
    raise exception 'DOC FAIL: partner cannot see shared finance attachment';
  end if;
end $$;
commit;

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.documents) <> 0 or (select count(*) from storage.objects) <> 0 or (select count(*) from public.document_attachments) <> 0 then
    raise exception 'DOC FAIL: outsider can see a document, attachment or file';
  end if;
  if public.current_user_can_access_document_entity('FINANCE_RECORD', '00000000-0000-4000-8000-0000000000f2') then
    raise exception 'DOC FAIL: outsider can access financial record';
  end if;
end $$;
commit;

-- Display names are shared only with active members; full profiles stay private.
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.household_member_names('00000000-0000-4000-8000-0000000000f1')) <> 2 then
    raise exception 'MEMBER NAMES FAIL: member should see both names';
  end if;
  if (select count(*) from public.profiles where id = '00000000-0000-4000-8000-00000000000a') <> 0 then
    raise exception 'MEMBER NAMES FAIL: full private profile exposed';
  end if;
end $$;
commit;
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.household_member_names('00000000-0000-4000-8000-0000000000f1')) <> 0 then
    raise exception 'MEMBER NAMES FAIL: outsider saw names';
  end if;
end $$;
commit;

-- Mobile create RPCs are atomic and respect caller membership and RLS.
begin;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-00000000000a', 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare tid uuid; cid uuid; rejected boolean := false;
begin
  tid := public.mobile_create_task('{"title":"کار موبایل","visibility":"PRIVATE","priority":"NORMAL","status":"PENDING","assigneeIds":[],"recurrence":{"frequency":"NONE"}}'::jsonb);
  if not exists(select 1 from public.task_assignees where task_id = tid and assignee_id = auth.uid()) then raise exception 'task assignee missing'; end if;
  cid := public.mobile_create_chore('{"title":"کار خانه موبایل","rotationMode":"FIXED","frequency":"WEEKLY","assigneeIds":[]}'::jsonb);
  if not exists(select 1 from public.chore_rotation_steps where chore_id = cid and assignee_id = auth.uid()) then raise exception 'chore assignee missing'; end if;
  begin
    perform public.mobile_create_chore('{"title":"کار نامجاز","rotationMode":"FIXED","frequency":"WEEKLY","assigneeIds":["00000000-0000-4000-8000-00000000000c"]}'::jsonb);
  exception when others then rejected := true; end;
  if not rejected or exists(select 1 from public.chores where title = 'کار نامجاز') then raise exception 'invalid assignee should leave no chore'; end if;
  rejected := false;
  begin
    perform public.mobile_create_task('{"title":"تسک نامجاز","visibility":"PRIVATE","assigneeIds":["00000000-0000-4000-8000-00000000000b"],"recurrence":{"frequency":"NONE"}}'::jsonb);
  exception when others then rejected := true; end;
  if not rejected or exists(select 1 from public.tasks where title = 'تسک نامجاز') then raise exception 'invalid assignee should leave no task'; end if;
  if has_function_privilege('anon', 'public.mobile_create_task(jsonb)', 'execute') or has_function_privilege('anon', 'public.mobile_create_chore(jsonb)', 'execute') then raise exception 'anonymous execution must be denied'; end if;
end $$;
rollback;

-- Mobile updates replace details and assignments atomically under caller RLS.
begin;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-00000000000a', 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare tid uuid; cid uuid; rejected boolean := false;
begin
  tid := public.mobile_create_task('{"title":"قبل","visibility":"PRIVATE","assigneeIds":[],"recurrence":{"frequency":"NONE"}}'::jsonb);
  perform public.mobile_update_task(tid, '{"title":"بعد","visibility":"PRIVATE","priority":"HIGH","assigneeIds":[],"recurrence":{"frequency":"DAILY"}}'::jsonb);
  if not exists(select 1 from public.tasks where id=tid and title='بعد' and priority='HIGH') or not exists(select 1 from public.task_recurrences where task_id=tid and frequency='DAILY') then raise exception 'task update failed'; end if;
  cid := public.mobile_create_chore('{"title":"قبل","rotationMode":"FIXED","frequency":"WEEKLY","assigneeIds":[]}'::jsonb);
  perform public.mobile_update_chore(cid, '{"title":"بعد","rotationMode":"FIXED","frequency":"DAILY","assigneeIds":[]}'::jsonb);
  if not exists(select 1 from public.chores where id=cid and title='بعد' and frequency='DAILY') then raise exception 'chore update failed'; end if;
  begin
    perform public.mobile_update_chore(cid, '{"title":"نامعتبر","rotationMode":"FIXED","frequency":"WEEKLY","assigneeIds":["00000000-0000-4000-8000-00000000000c"]}'::jsonb);
  exception when others then rejected := true; end;
  if not rejected or not exists(select 1 from public.chores where id=cid and title='بعد') then raise exception 'unauthorized update not rejected atomically'; end if;
end $$;
rollback;

-- Recurring task completion is atomic, access-controlled and idempotent.
begin;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-00000000000a', 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare original uuid; successor uuid; repeated uuid; denied boolean := false;
begin
  original := public.mobile_create_task('{"title":"تکرار","visibility":"PRIVATE","dueAt":"2026-11-01T00:00:00Z","assigneeIds":[],"nextOccurrenceAt":"2026-11-02T00:00:00Z","recurrence":{"frequency":"DAILY"}}'::jsonb);
  successor := public.mobile_complete_task(original);
  repeated := public.mobile_complete_task(original);
  if successor is null or successor <> repeated then raise exception 'completion must be idempotent'; end if;
  if not exists(select 1 from public.tasks where id=original and status='COMPLETED') then raise exception 'original not completed'; end if;
  if not exists(select 1 from public.tasks where id=successor and status='PENDING' and due_at='2026-11-02T00:00:00Z') then raise exception 'successor wrong'; end if;
  if not exists(select 1 from public.task_recurrences where task_id=successor and next_occurrence_at='2026-11-03T00:00:00Z') then raise exception 'next date wrong'; end if;
  if (select count(*) from public.task_recurrence_instances where completed_task_id=original) <> 1 then raise exception 'duplicate successor'; end if;
  begin
    insert into public.task_recurrence_instances(completed_task_id,next_task_id) values(successor,original);
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'direct link write must be denied'; end if;
end $$;
rollback;

begin;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-00000000000c', 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare blocked boolean := false; target uuid;
begin
  select id into target from public.tasks where title='تسک خصوصی آرش';
  if target is not null then raise exception 'outsider should not see private task'; end if;
  begin
    perform public.mobile_complete_task('00000000-0000-4000-8000-0000000000c1'::uuid);
  exception when others then blocked := true; end;
  if not blocked then raise exception 'outsider completion must be denied'; end if;
end $$;
rollback;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'financial_records') then
    raise exception 'financial_records must be published for realtime';
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.documents'::regclass and conname = 'documents_category_check') then
    raise exception 'document categories must be constrained';
  end if;
end $$;

-- Narrow device credentials: registration is authenticated, snapshots contain
-- only that user's scheduling data, and revoked/foreign tokens are rejected.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', false);
select public.register_reminder_device('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('a',64));
insert into public.reminders (id,target_type,target_id,user_id,remind_at,status) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','TASK','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','00000000-0000-4000-8000-00000000000a',now() + interval '1 day','PENDING'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','TASK','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4','00000000-0000-4000-8000-00000000000b',now() + interval '1 day','PENDING');
do $$
declare snapshot jsonb;
begin
  if has_table_privilege('anon','public.reminder_devices','select') or
     has_table_privilege('authenticated','public.reminder_devices','select') or
     has_function_privilege('anon','public.register_reminder_device(uuid,text)','execute') then
    raise exception 'device credential privileges too broad';
  end if;
  snapshot := public.read_reminder_device('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',repeat('a',64));
  if jsonb_typeof(snapshot->'reminders') <> 'array' then raise exception 'missing snapshot'; end if;
  if not (snapshot->'reminders' @> '[{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"}]'::jsonb)
     or snapshot->'reminders' @> '[{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2"}]'::jsonb then
    raise exception 'device snapshot isolation failure';
  end if;
  begin
    perform public.read_reminder_device('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',repeat('b',64));
    raise exception 'bad credential accepted';
  exception when invalid_authorization_specification then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', false);
do $$ begin
  begin
    perform public.register_reminder_device('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('b',64));
    raise exception 'foreign account overwrote device';
  exception when raise_exception then
    if sqlerrm = 'foreign account overwrote device' then raise; end if;
  end;
end $$;
select public.revoke_reminder_device('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select public.read_reminder_device('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',repeat('a',64));
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', false);
select public.revoke_reminder_device('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
do $$ begin
  begin
    perform public.read_reminder_device('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',repeat('a',64));
    raise exception 'revoked credential accepted';
  exception when invalid_authorization_specification then null; end;
end $$;

-- Metadata cannot call a household-readable file private (or vice versa).
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$
declare denied boolean := false;
begin
  begin
    insert into public.documents (created_by, title, mime_type, file_size, storage_path, visibility)
    values (auth.uid(), 'incorrect private path', 'application/pdf', 1,
      'household/00000000-0000-4000-8000-0000000000f1/bad/file.pdf', 'PRIVATE');
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'private document accepted a shared storage path'; end if;
  denied := false;
  begin
    insert into public.documents (household_id, created_by, title, mime_type, file_size, storage_path, visibility)
    values ('00000000-0000-4000-8000-0000000000f1', auth.uid(), 'incorrect shared path', 'application/pdf', 1,
      'user/00000000-0000-4000-8000-00000000000a/bad/file.pdf', 'HOUSEHOLD_SHARED');
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'shared document accepted a private storage path'; end if;
  insert into public.documents (created_by, title, mime_type, file_size, storage_path, visibility)
  values (auth.uid(), 'valid private path', 'application/pdf', 1,
    'user/00000000-0000-4000-8000-00000000000a/new/file.pdf', 'PRIVATE');
  insert into public.documents (household_id, created_by, title, mime_type, file_size, storage_path, visibility)
  values ('00000000-0000-4000-8000-0000000000f1', auth.uid(), 'valid shared path', 'application/pdf', 1,
    'household/00000000-0000-4000-8000-0000000000f1/new/file.pdf', 'HOUSEHOLD_SHARED');
end $$;
rollback;

-- Exercise storage writes as a different household member, not just SELECT.
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
do $$
declare denied boolean := false; affected integer;
begin
  begin
    insert into storage.objects(bucket_id,name) values
      ('documents','user/00000000-0000-4000-8000-00000000000a/new/forged.pdf');
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'DOC FAIL: partner can upload to another user private prefix'; end if;
  delete from storage.objects where name = 'user/00000000-0000-4000-8000-00000000000a/doc/file.pdf';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'DOC FAIL: partner deleted another user private file'; end if;
  update storage.objects set name = 'user/00000000-0000-4000-8000-00000000000b/stolen.pdf'
    where name = 'user/00000000-0000-4000-8000-00000000000a/doc/file.pdf';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'DOC FAIL: partner modified another user private file'; end if;
  insert into storage.objects(bucket_id,name) values
    ('documents','user/00000000-0000-4000-8000-00000000000b/new/file.pdf'),
    ('documents','household/00000000-0000-4000-8000-0000000000f1/new/file.pdf');
  delete from storage.objects where name = 'household/00000000-0000-4000-8000-0000000000f1/new/file.pdf';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'DOC FAIL: member cannot manage shared file'; end if;
end $$;
rollback;

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
do $$
declare denied boolean := false; affected integer;
begin
  begin
    insert into storage.objects(bucket_id,name) values
      ('documents','household/00000000-0000-4000-8000-0000000000f1/new/forged.pdf');
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'DOC FAIL: outsider can upload to household'; end if;
  delete from storage.objects where name = 'household/00000000-0000-4000-8000-0000000000f1/doc/file.pdf';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'DOC FAIL: outsider deleted household file'; end if;
end $$;
rollback;

-- Changing an account password immediately invalidates its device credential.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', false);
select public.register_reminder_device('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab', repeat('c',64));
update auth.users set encrypted_password = 'changed-test-password' where id = '00000000-0000-4000-8000-00000000000a';
do $$ begin
  begin
    perform public.read_reminder_device('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab', repeat('c',64));
    raise exception 'password change did not revoke device credential';
  exception when invalid_authorization_specification then null; end;
end $$;
select public.register_reminder_device('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab', repeat('c',64));
select public.read_reminder_device('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab', repeat('c',64));
select public.revoke_reminder_device('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab');

-- Verify export projections exist and are selectable by an authenticated user.
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select id,title,description,creator_id,owner_id,household_id,visibility,status,priority,due_at,completed_at,archived_at,created_at,updated_at from public.tasks limit 0;
select id,task_id,assignee_id,created_at from public.task_assignees limit 0;
select id,task_id,frequency,interval_days,weekdays,next_occurrence_at,created_at,updated_at from public.task_recurrences limit 0;
select id,title,description,creator_id,owner_id,household_id,visibility,start_at,end_at,all_day,location,created_at,updated_at from public.events limit 0;
select id,target_type,target_id,user_id,household_id,remind_at,status,snoozed_until,snooze_count,delivered_at,created_at,updated_at from public.reminders limit 0;
select id,user_id,in_app_enabled,web_push_enabled,quiet_hours_enabled,quiet_hours_start,quiet_hours_end,created_at,updated_at from public.notification_preferences limit 0;
select id,household_id,title,description,created_by,rotation_mode,current_rotation_index,frequency,interval_days,weekdays,next_due_at,is_active,archived_at,created_at,updated_at from public.chores limit 0;
select id,chore_id,position,assignee_id,created_at from public.chore_rotation_steps limit 0;
select id,chore_id,completed_by,completed_at,due_at,note,created_at from public.chore_completions limit 0;
select id,household_id,name,created_by,archived_at,created_at,updated_at from public.shopping_lists limit 0;
select id,list_id,name,quantity,unit,category,note,added_by,purchased,purchased_by,purchased_at,position,created_at,updated_at from public.shopping_items limit 0;
select id,household_id,owner_id,created_by,visibility,record_type,title,amount,currency,category,note,occurred_at,due_at,bill_status,is_recurring,recurrence_rule,recurrence_timezone,paid_by,paid_at,archived_at,created_at,updated_at from public.financial_records limit 0;
select id,household_id,created_by,title,description,visibility,category,mime_type,file_size,storage_path,created_at,updated_at from public.documents limit 0;
select id,document_id,entity_type,entity_id,created_by,created_at from public.document_attachments limit 0;
rollback;

-- Recurrences use stored local wall time, including local weekday and DST.
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_task_id uuid; successor uuid; chore_id uuid; due timestamptz;
begin
  if public.next_zoned_recurrence('2026-03-01 14:00+00','WEEKLY',null,array[0],'America/New_York') <> '2026-03-08 13:00+00'::timestamptz then raise exception 'DST weekday'; end if;
  if public.next_zoned_recurrence('2026-03-07 07:30+00','DAILY',null,null,'America/New_York') <> '2026-03-08 07:30+00'::timestamptz then raise exception 'DST gap'; end if;
  if public.next_zoned_recurrence('2026-10-31 05:30+00','DAILY',null,null,'America/New_York') <> '2026-11-01 06:30+00'::timestamptz then raise exception 'DST fold'; end if;
  if public.next_zoned_recurrence('2026-01-03 21:30+00','WEEKLY',null,array[0],'Asia/Tehran') <> '2026-01-10 21:30+00'::timestamptz then raise exception 'local weekday'; end if;
  if public.next_zoned_recurrence('2026-01-31 12:00+00','MONTHLY',null,null,'UTC') <> '2026-02-28 12:00+00'::timestamptz then raise exception 'month end'; end if;
  begin
    perform public.mobile_create_task('{"title":"invalid timezone","visibility":"PRIVATE","recurrence":{"frequency":"DAILY"},"recurrenceTimezone":"not/a/zone"}'::jsonb);
    raise exception 'invalid timezone was accepted';
  exception when raise_exception then if sqlerrm <> 'INVALID_RECURRENCE_TIMEZONE' then raise; end if; end;
  v_task_id := public.mobile_create_task('{"title":"test recurrence","visibility":"PRIVATE","priority":"NORMAL","dueAt":"2026-03-01T14:00:00Z","recurrence":{"frequency":"WEEKLY","weekdays":[0]},"recurrenceTimezone":"America/New_York"}'::jsonb);
  if not exists(select 1 from public.task_recurrences where task_recurrences.task_id=v_task_id and next_occurrence_at='2026-03-08 13:00+00' and recurrence_timezone='America/New_York') then raise exception 'task create zone'; end if;
  successor := public.mobile_complete_task(v_task_id);
  if not exists(select 1 from public.tasks where id=successor and due_at='2026-03-08 13:00+00') then raise exception 'task successor zone'; end if;
  if public.mobile_complete_task(v_task_id) <> successor then raise exception 'completion not idempotent'; end if;
  if not exists(select 1 from public.task_recurrences where task_recurrences.task_id=successor and next_occurrence_at='2026-03-15 13:00+00' and recurrence_timezone='America/New_York') then raise exception 'successor recurrence zone'; end if;
  chore_id := public.mobile_create_chore('{"title":"test chore","nextDueAt":"2026-03-01T14:00:00Z","frequency":"WEEKLY","weekdays":[0],"rotationMode":"FIXED","recurrenceTimezone":"America/New_York"}'::jsonb);
  select c.next_due_at into due from public.complete_chore(chore_id) c;
  if due <> '2026-03-08 13:00+00'::timestamptz then raise exception 'chore successor zone'; end if;
  update public.chores set archived_at=now(), is_active=false where id=chore_id;
  begin perform public.complete_chore(chore_id); raise exception 'inactive chore allowed';
  exception when raise_exception then if sqlerrm <> 'CHORE_INACTIVE' then raise; end if; end;
end $$;
rollback;

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$
declare bill uuid; successor uuid; n integer;
begin
  insert into public.financial_records(owner_id,created_by,visibility,record_type,title,amount,currency,due_at,is_recurring,recurrence_rule,recurrence_timezone)
  values(auth.uid(),auth.uid(),'PRIVATE','BILL','recurring test',10,'USD','2026-03-01 14:00+00',true,'WEEKLY','America/New_York') returning id into bill;
  update public.financial_records set paid_at=now(),paid_by=auth.uid() where id=bill;
  select next_record_id into successor from public.finance_recurrence_instances where paid_record_id=bill;
  if successor is null or not exists(select 1 from public.financial_records where id=successor and owner_id=auth.uid() and currency='USD' and due_at='2026-03-08 13:00+00' and paid_at is null) then raise exception 'recurring bill successor'; end if;
  update public.financial_records set paid_at=now() where id=bill;
  select count(*) into n from public.finance_recurrence_instances where paid_record_id=bill;
  if n <> 1 then raise exception 'duplicate recurring bill'; end if;
  begin update public.financial_records set paid_at=null,paid_by=null where id=bill; raise exception 'recurring undo permitted';
  exception when raise_exception then if sqlerrm <> 'RECURRING_BILL_CANNOT_UNDO' then raise; end if; end;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
  if exists(select 1 from public.finance_recurrence_instances where paid_record_id=bill) then raise exception 'recurrence leaks private bill'; end if;
  update public.financial_records set paid_at=now(),paid_by=auth.uid() where id=successor;
  if found then raise exception 'outsider can pay private successor'; end if;
end $$;
rollback;

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$
declare cid uuid; completed uuid; n integer;
begin
  cid := public.mobile_create_chore('{"title":"guarded occurrence","nextDueAt":"2026-03-01T14:00:00Z","frequency":"DAILY","rotationMode":"FIXED","recurrenceTimezone":"UTC"}'::jsonb);
  completed := public.complete_chore_expected_due(cid, '2026-03-01 14:00+00');
  if completed is null then raise exception 'completion missing'; end if;
  begin
    perform public.complete_chore_expected_due(cid, '2026-03-01 14:00+00');
    raise exception 'stale occurrence accepted';
  exception when raise_exception then if sqlerrm <> 'CHORE_OCCURRENCE_CHANGED' then raise; end if; end;
  select count(*) into n from public.chore_completions where chore_id=cid;
  if n <> 1 then raise exception 'duplicate completion'; end if;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
  begin
    perform public.complete_chore_expected_due(cid, '2026-03-02 14:00+00');
    raise exception 'outsider accepted';
  exception when raise_exception then if sqlerrm <> 'CHORE_NOT_FOUND_OR_FORBIDDEN' then raise; end if; end;
  if has_function_privilege('anon', 'public.complete_chore_expected_due(uuid,timestamptz)', 'execute') then raise exception 'anon can complete'; end if;
end $$;
rollback;

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$
declare cid uuid; bid uuid; n integer;
begin
  cid := public.mobile_create_chore('{"title":"reminder chore","frequency":"DAILY","rotationMode":"FIXED","recurrenceTimezone":"UTC"}'::jsonb);
  insert into public.financial_records(owner_id,created_by,visibility,record_type,title,amount) values(auth.uid(),auth.uid(),'PRIVATE','BILL','reminder bill',5) returning id into bid;
  insert into public.reminders(user_id,target_type,target_id,household_id,remind_at) values(auth.uid(),'CHORE',cid,'00000000-0000-4000-8000-0000000000f1',now()), (auth.uid(),'BILL',bid,null,now());
  select count(*) into n from public.reminders where target_id in (cid,bid);
  if n <> 2 then raise exception 'new reminder targets missing'; end if;
  if public.current_user_can_create_reminder('CHORE',cid,null) then raise exception 'invalid chore household'; end if;
  if public.current_user_can_create_reminder('BILL',bid,'00000000-0000-4000-8000-0000000000f1') then raise exception 'invalid bill household'; end if;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
  if public.current_user_can_create_reminder('CHORE',cid,'00000000-0000-4000-8000-0000000000f1') or public.current_user_can_create_reminder('BILL',bid,null) then raise exception 'unauthorized target access'; end if;
end $$;
rollback;

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$
declare cid uuid; version bigint; result uuid;
begin
 cid := public.mobile_create_chore('{"title":"no due version check","frequency":"NONE","rotationMode":"FIXED","recurrenceTimezone":"UTC"}'::jsonb);
 select completion_revision into version from public.chores where id=cid;
 begin perform public.complete_chore_expected_version(cid,version - 1); raise exception 'stale accepted';
 exception when raise_exception then if sqlerrm <> 'CHORE_VERSION_CHANGED' then raise; end if; end;
 result := public.complete_chore_expected_version(cid, version);
 if result is null then raise exception 'missing completion'; end if;
 begin perform public.complete_chore_expected_version(cid,version); raise exception 'duplicate accepted';
 exception when raise_exception then if sqlerrm <> 'CHORE_VERSION_CHANGED' then raise; end if; end;
 perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
 begin perform public.complete_chore_expected_version(cid, version); raise exception 'outsider accepted';
 exception when raise_exception then if sqlerrm <> 'CHORE_NOT_FOUND_OR_FORBIDDEN' then raise; end if; end;
 if has_function_privilege('anon', 'public.complete_chore_expected_version(uuid,bigint)', 'execute') then raise exception 'anon can execute'; end if;
end $$;
rollback;

-- Filtered search applies filters before the 50-result page and respects RLS.
begin;
insert into public.tasks (title, creator_id, owner_id, visibility, priority, due_at)
select 'test-filtered-search', '00000000-0000-4000-8000-00000000000a',
       '00000000-0000-4000-8000-00000000000a', 'PRIVATE', 'NORMAL', now() - interval '50 days'
from generate_series(1, 55);
insert into public.tasks (title, creator_id, owner_id, visibility, priority, due_at)
values ('test-filtered-search', '00000000-0000-4000-8000-00000000000a',
        '00000000-0000-4000-8000-00000000000a', 'PRIVATE', 'NORMAL', now());
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$
declare answer jsonb;
begin
  answer := public.search_workspace_filtered('test-filtered-search',array['task'],now() - interval '7 days',now()+interval '1 day',0);
  if (answer->>'total')::int <> 1 or jsonb_array_length(answer->'results') <> 1 then raise exception 'filtered search must filter before limit: %', answer; end if;
  answer := public.search_workspace_filtered('test-filtered-search',array['task'],null,null,50);
  if (answer->>'total')::int <> 56 or jsonb_array_length(answer->'results') <> 6 then raise exception 'search pagination failed: %', answer; end if;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
  answer := public.search_workspace_filtered('test-filtered-search');
  if (answer->>'total')::int <> 0 then raise exception 'search leaks private tasks: %', answer; end if;
end $$;
rollback;
do $$ begin
  if has_function_privilege('anon','public.search_workspace_filtered(text,text[],timestamptz,timestamptz,integer)','execute') then
    raise exception 'anonymous filtered search must be denied';
  end if;
end $$;

-- A stale edit must not overwrite a newer completion or edit.
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  begin
    perform public.mobile_update_chore_guarded('00000000-0000-4000-8000-0000000000c1','{}'::jsonb,'2000-01-01'::timestamptz);
    raise exception 'stale edit was not rejected';
  exception when others then
    if sqlerrm <> 'STALE_CHORE' then raise; end if;
  end;
end $$;
rollback;
do $$ begin
  if has_function_privilege('anon','public.mobile_update_chore_guarded(uuid,jsonb,timestamptz)','execute') then raise exception 'anonymous chore update must be denied'; end if;
end $$;

-- The guarded wrapper also accepts the current version under normal RLS.
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_id uuid; v_time timestamptz; v_result uuid;
begin
  insert into public.chores(household_id,title,created_by,rotation_mode,frequency)
  values ('00000000-0000-4000-8000-0000000000f1','نگهبان نسخه','00000000-0000-4000-8000-00000000000a','FIXED','DAILY') returning id,updated_at into v_id,v_time;
  v_result := public.mobile_update_chore_guarded(v_id, jsonb_build_object('title','عنوان اصلاح‌شده','rotationMode','FIXED','frequency','DAILY','assigneeIds',jsonb_build_array('00000000-0000-4000-8000-00000000000a'),'recurrenceTimezone','UTC'),v_time);
  if v_result <> v_id or not exists(select 1 from public.chores where id=v_id and title='عنوان اصلاح‌شده') then raise exception 'guarded current update failed'; end if;
end $$;
rollback;

-- Guard a task edit using the displayed timestamp while preserving RLS.
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_id uuid; v_time timestamptz; v_result uuid;
begin
  insert into public.tasks(title,creator_id,owner_id,visibility,priority)
    values ('تسک ویرایشی','00000000-0000-4000-8000-00000000000a','00000000-0000-4000-8000-00000000000a','PRIVATE','NORMAL') returning id,updated_at into v_id,v_time;
  begin
    perform public.mobile_update_task_guarded(v_id,'{}'::jsonb,'2000-01-01'::timestamptz);
    raise exception 'stale task update was not rejected';
  exception when others then
    if sqlerrm <> 'STALE_TASK' then raise; end if;
  end;
  v_result := public.mobile_update_task_guarded(v_id,jsonb_build_object('title','تسک اصلاح‌شده','visibility','PRIVATE','priority','NORMAL','assigneeIds',jsonb_build_array(),'recurrence',jsonb_build_object('frequency','NONE'),'recurrenceTimezone','UTC'),v_time);
  if v_result <> v_id or not exists (select 1 from public.tasks where id=v_id and title='تسک اصلاح‌شده') then raise exception 'guarded task update failed'; end if;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
  begin
    perform public.mobile_update_task_guarded(v_id,'{}'::jsonb,v_time);
    raise exception 'unauthorized task update was not rejected';
  exception when others then
    if sqlerrm <> 'STALE_TASK' then raise; end if;
  end;
end $$;
rollback;
do $$ begin
  if has_function_privilege('anon','public.mobile_update_task_guarded(uuid,jsonb,timestamptz)','execute') then raise exception 'anonymous task update must be denied'; end if;
end $$;

-- Standalone queue is service-only, deduplicated per snapshot, and never marks
-- reminders as sent (Android still needs to discover them).
begin;
do $$
declare a uuid := '00000000-0000-4000-8000-00000000000a'; rid uuid; sid uuid; job record; second_job record; n integer;
begin
  if has_function_privilege('anon','public.standalone_push_claim(integer)','execute') or has_function_privilege('authenticated','public.standalone_push_claim(integer)','execute') or not has_function_privilege('service_role','public.standalone_push_claim(integer)','execute') then raise exception 'invalid queue grants'; end if;
  if has_table_privilege('authenticated','public.standalone_push_jobs','select') then raise exception 'queue must not be visible'; end if;
  update public.profiles set timezone='UTC' where id=a;
  insert into public.notification_preferences(user_id,web_push_enabled,quiet_hours_enabled) values(a,true,false) on conflict(user_id) do update set web_push_enabled=true,quiet_hours_enabled=false;
  insert into public.reminders(user_id,target_type,target_id,remind_at) values(a,'TASK',gen_random_uuid(),now()-interval '1 minute') returning id into rid;
  insert into public.push_subscriptions(user_id,endpoint,p256dh,auth) values(a,'https://updates.push.services.mozilla.com/wpush/v2/db-test','aaaaaaaaaaaaaaaaaaaa','aaaaaaaa') returning id into sid;
  select * into job from public.standalone_push_claim(1);
  if job.job_id is null or not public.standalone_push_validate(job.job_id,job.token) then raise exception 'queue claim failed'; end if;
  if (select status from public.reminders where id=rid) <> 'PENDING' then raise exception 'queue changed reminder status'; end if;
  if public.standalone_push_finish(job.job_id,gen_random_uuid(),'sent') then raise exception 'wrong lease token succeeded'; end if;
  if not public.standalone_push_finish(job.job_id,job.token,'retry') then raise exception 'retry failed'; end if;
  if exists(select 1 from public.standalone_push_claim(1)) then raise exception 'backoff ignored'; end if;
  update public.standalone_push_jobs set next_attempt_at=now()-interval '1 second' where id=job.job_id;
  select * into second_job from public.standalone_push_claim(1);
  if second_job.job_id <> job.job_id or second_job.token=job.token then raise exception 'reclaim failed'; end if;
  update public.reminders set status='CANCELED' where id=rid;
  if public.standalone_push_validate(second_job.job_id,second_job.token) then raise exception 'canceled reminder still eligible'; end if;
  if not public.standalone_push_finish(second_job.job_id,second_job.token,'stale') then raise exception 'stale finish failed'; end if;
  update public.reminders set status='PENDING' where id=rid;
  -- Transaction-level now() doesn't advance the updated_at trigger: reset the
  -- test job to exercise quiet hours on the same snapshot.
  update public.standalone_push_jobs set state='PENDING',next_attempt_at=now(),finished_at=null where id=job.job_id;
  -- Set quiet interval around the current UTC minute; must defer.
  update public.notification_preferences set quiet_hours_enabled=true,quiet_hours_start=to_char(now() at time zone 'UTC','HH24:MI'),quiet_hours_end=to_char((now()+interval '1 minute') at time zone 'UTC','HH24:MI') where user_id=a;
  if exists(select 1 from public.standalone_push_claim(1)) then raise exception 'quiet hours ignored'; end if;
  update public.notification_preferences set quiet_hours_enabled=false where user_id=a;
  select * into second_job from public.standalone_push_claim(1);
  if second_job.job_id is null then raise exception 'claim after quiet hours missing'; end if;
  if not public.standalone_push_finish(second_job.job_id,second_job.token,'expired') then raise exception 'expired finish failed'; end if;
  if (select revoked_at from public.push_subscriptions where id=sid) is null then raise exception 'expired subscription not revoked'; end if;
  select count(*) into n from public.standalone_push_claim(1);
  if n<>0 then raise exception 'revoked subscription claimed'; end if;
  insert into public.push_subscriptions(user_id,endpoint,p256dh,auth) values(a,'https://push.services.mozilla.com/wpush/v2/second-db-test','aaaaaaaaaaaaaaaaaaaa','aaaaaaaa') returning id into sid;
  select * into job from public.standalone_push_claim(1);
  if job.job_id is null or not public.standalone_push_finish(job.job_id,job.token,'sent') then raise exception 'send finish failed'; end if;
  if exists(select 1 from public.standalone_push_claim(1)) then raise exception 'duplicate push queued'; end if;
  if (select status from public.reminders where id=rid) <> 'PENDING' then raise exception 'push must not mark reminder SENT'; end if;
end $$;
rollback;

-- Minimal chore edits must not recreate rotation steps or modify due dates.
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$
declare cid uuid; version timestamptz; step_ids uuid[]; result uuid;
begin
 cid := public.mobile_create_chore('{"title":"پچ کار","rotationMode":"ROTATING","frequency":"DAILY","nextDueAt":"2030-01-01T09:00:00Z","assigneeIds":["00000000-0000-4000-8000-00000000000a","00000000-0000-4000-8000-00000000000b"],"recurrenceTimezone":"UTC"}'::jsonb);
 update public.chores set current_rotation_index=1 where id=cid;
 select updated_at into version from public.chores where id=cid;
 select array_agg(id order by position) into step_ids from public.chore_rotation_steps where chore_id=cid;
 result := public.mobile_patch_chore(cid,'{"title":"نام جدید"}'::jsonb,version);
 if result<>cid or not exists(select 1 from public.chores where id=cid and title='نام جدید' and current_rotation_index=1 and next_due_at='2030-01-01T09:00:00Z'::timestamptz and recurrence_timezone='UTC') then raise exception 'patch changed unrelated fields'; end if;
 if step_ids is distinct from (select array_agg(id order by position) from public.chore_rotation_steps where chore_id=cid) then raise exception 'patch recreated rotation steps'; end if;
 begin perform public.mobile_patch_chore(cid,'{"title":"stale"}'::jsonb,'2000-01-01'); raise exception 'stale patch accepted'; exception when others then if sqlerrm<>'STALE_CHORE' then raise; end if; end;
 begin perform public.mobile_patch_chore(cid,'{"is_active":false}'::jsonb,version); raise exception 'unknown patch field accepted'; exception when others then if sqlerrm<>'INVALID_PATCH' then raise; end if; end;
 begin perform public.mobile_patch_chore(cid,'{"assigneeIds":["00000000-0000-4000-8000-00000000000a","00000000-0000-4000-8000-00000000000c"]}'::jsonb,version); raise exception 'outsider added'; exception when others then if sqlerrm<>'INVALID_ASSIGNEES' then raise; end if; end;
 result := public.mobile_patch_chore(cid,'{"nextDueAt":null,"recurrenceTimezone":"Asia/Tehran"}'::jsonb,version);
 if not exists(select 1 from public.chores where id=cid and next_due_at is null and recurrence_timezone='Asia/Tehran') then raise exception 'clear due patch failed'; end if;
 perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
 begin perform public.mobile_patch_chore(cid,'{"title":"forbidden"}'::jsonb,version); raise exception 'outsider edited'; exception when others then if sqlerrm<>'STALE_CHORE' then raise; end if; end;
end $$;
rollback;
do $$ begin
  if has_function_privilege('anon','public.mobile_patch_chore(uuid,jsonb,timestamptz)','execute') then raise exception 'anonymous chore patch must be denied'; end if;
end $$;

-- An orphan scan is read-only, delayed and isolated to the caller's prefix.
begin;
insert into storage.objects(bucket_id,name,created_at) values
 ('documents','user/00000000-0000-4000-8000-00000000000a/old/lost.pdf',now()-interval '8 days'),
 ('documents','user/00000000-0000-4000-8000-00000000000a/new/pending.pdf',now()-interval '1 day'),
 ('documents','user/00000000-0000-4000-8000-00000000000a/old/linked.pdf',now()-interval '8 days'),
 ('documents','user/00000000-0000-4000-8000-00000000000c/old/private.pdf',now()-interval '8 days');
insert into public.documents(created_by,title,mime_type,file_size,storage_path,visibility) values ('00000000-0000-4000-8000-00000000000a','linked','application/pdf',1,'user/00000000-0000-4000-8000-00000000000a/old/linked.pdf','PRIVATE');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$ declare n integer; begin
 select count(*) into n from public.possible_orphan_documents();
 if n<>1 or not exists(select 1 from public.possible_orphan_documents() where path like '%/lost.pdf') then raise exception 'orphan scan leaked or missed files'; end if;
 if has_function_privilege('anon','public.possible_orphan_documents()','execute') then raise exception 'anonymous orphan scan allowed'; end if;
end $$;
rollback;

-- Snapshot has one transaction snapshot, explicit columns and respects user RLS.
begin;
insert into public.tasks(title,creator_id,owner_id,visibility,priority)
 values ('snapshot-private-a','00000000-0000-4000-8000-00000000000a','00000000-0000-4000-8000-00000000000a','PRIVATE','NORMAL'),
 ('snapshot-private-c','00000000-0000-4000-8000-00000000000c','00000000-0000-4000-8000-00000000000c','PRIVATE','NORMAL');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$ declare snapshot jsonb; begin
 snapshot:=public.mobile_export_snapshot();
 if (snapshot->'tables'->'tasks')::text not like '%snapshot-private-a%' or (snapshot->'tables'->'tasks')::text like '%snapshot-private-c%' then raise exception 'snapshot RLS failure'; end if;
 if (snapshot->'counts'->>'tasks')::integer <> jsonb_array_length(snapshot->'tables'->'tasks') then raise exception 'snapshot count mismatch'; end if;
 if snapshot->'tables' ? 'push_subscriptions' or snapshot->'tables' ? 'household_invitations' or snapshot->'tables' ? 'reminder_devices' then raise exception 'secrets included'; end if;
 if not (snapshot->'tables' ? 'profiles' and snapshot->'tables' ? 'task_recurrence_instances' and snapshot->'tables' ? 'finance_recurrence_instances') then raise exception 'snapshot tables missing'; end if;
 if has_function_privilege('anon','public.mobile_export_snapshot()','execute') then raise exception 'anonymous snapshot allowed'; end if;
end $$;
rollback;

-- Recovery is bounded, idempotent and atomic under the caller's own RLS.
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$
declare tid uuid; snapshot jsonb; broken jsonb; result jsonb;
begin
 insert into public.tasks(title,creator_id,owner_id,visibility,priority) values ('restore-owned','00000000-0000-4000-8000-00000000000a','00000000-0000-4000-8000-00000000000a','PRIVATE','NORMAL') returning id into tid;
 snapshot:=public.mobile_export_snapshot()->'tables';
 delete from public.tasks where id=tid;
 delete from public.documents where id='00000000-0000-4000-8000-0000000000e1';
 broken:=jsonb_set(snapshot,'{chore_completions}',(snapshot->'chore_completions') || '[{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}]'::jsonb);
 begin perform public.mobile_restore_missing(broken); raise exception 'missing history accepted'; exception when others then if sqlerrm<>'RESTORE_PARENT_OR_HISTORY_MISSING' then raise; end if; end;
 if exists(select 1 from public.tasks where id=tid) then raise exception 'partial restore was not rolled back'; end if;
 delete from storage.objects where bucket_id='documents' and name='user/00000000-0000-4000-8000-00000000000a/doc/file.pdf';
 begin perform public.mobile_restore_missing(snapshot); raise exception 'missing file accepted'; exception when others then if sqlerrm<>'RESTORE_DOCUMENT_FILE_MISSING' then raise; end if; end;
 if exists(select 1 from public.tasks where id=tid) then raise exception 'file failure did not roll back'; end if;
 insert into storage.objects(bucket_id,name) values ('documents','user/00000000-0000-4000-8000-00000000000a/doc/file.pdf');
 result:=public.mobile_restore_missing(snapshot);
 if (result->>'inserted')::integer<2 or not exists(select 1 from public.tasks where id=tid and title='restore-owned') or not exists(select 1 from public.documents where id='00000000-0000-4000-8000-0000000000e1') then raise exception 'restore failed'; end if;
 result:=public.mobile_restore_missing(snapshot);
 if (result->>'inserted')::integer<>0 then raise exception 'repeat restore created duplicates'; end if;
 perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
 begin perform public.mobile_restore_missing(snapshot); raise exception 'other user accepted'; exception when others then if sqlerrm not in ('RESTORE_PARENT_OR_HISTORY_MISSING','new row violates row-level security policy for table "tasks"') and sqlstate <> '23505' then raise; end if; end;
 -- An attacker can submit arbitrary JSON directly, so RLS must independently reject a forged owner.
 broken:=(select jsonb_object_agg(k,'[]'::jsonb) from jsonb_object_keys(snapshot) k);
 broken:=jsonb_set(broken,'{tasks}',jsonb_build_array((select value from jsonb_array_elements(snapshot->'tasks') where value->>'id'=tid::text)));
 delete from public.tasks where id=tid; -- other account cannot see or delete it
 begin perform public.mobile_restore_missing(broken); raise exception 'forged task accepted'; exception when insufficient_privilege or unique_violation then null; end;
 if has_function_privilege('anon','public.mobile_restore_missing(jsonb)','execute') then raise exception 'anonymous recovery allowed'; end if;
end $$;
rollback;

-- Signed snapshots are generated under the caller's RLS, and no client can
-- sign arbitrary data, read the key, or reuse a signature as another account.
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$
declare signed jsonb; forged jsonb; plain jsonb;
begin
 signed:=public.mobile_signed_export_snapshot();
 plain:=public.mobile_export_snapshot();
 if signed->'payload'->'snapshot'->'tables' is distinct from plain->'tables' then raise exception 'signed export bypassed RLS'; end if;
 if not public.mobile_verify_snapshot_signature(signed->'payload',signed->>'signature') then raise exception 'valid signature rejected'; end if;
 forged:=jsonb_set(signed->'payload','{snapshot,tables,profiles,0,full_name}','"forged"'::jsonb);
 if public.mobile_verify_snapshot_signature(forged,signed->>'signature') then raise exception 'forged payload accepted'; end if;
 if has_table_privilege('authenticated',(select c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='backup_private' and c.relname='signing_key'),'select') or has_schema_privilege('authenticated','backup_private','usage') or pg_has_role('authenticated','khoonemoon_backup_signer','member') then raise exception 'signing secret reachable'; end if;
 if has_function_privilege('anon','public.mobile_signed_export_snapshot()','execute') or has_function_privilege('anon','public.mobile_verify_snapshot_signature(jsonb,text)','execute') then raise exception 'anonymous signature access'; end if;
 perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
 if public.mobile_verify_snapshot_signature(signed->'payload',signed->>'signature') then raise exception 'signature reused by another account'; end if;
end $$;
rollback;

-- Only previously signed historical rows can be reconstructed, without
-- bypassing current household/task access or changing parent state.
begin;
insert into public.tasks(id,title,creator_id,owner_id,visibility,status,priority)
 values ('11111111-1111-4111-8111-111111111110','prior','00000000-0000-4000-8000-00000000000a','00000000-0000-4000-8000-00000000000a','PRIVATE','COMPLETED','NORMAL'),
        ('11111111-1111-4111-8111-111111111111','next','00000000-0000-4000-8000-00000000000a','00000000-0000-4000-8000-00000000000a','PRIVATE','PENDING','NORMAL');
insert into public.task_recurrence_instances(completed_task_id,next_task_id) values ('11111111-1111-4111-8111-111111111110','11111111-1111-4111-8111-111111111111');
insert into public.financial_records(id,owner_id,created_by,visibility,record_type,title,amount,paid_at) values
 ('22222222-2222-4222-8222-222222222220','00000000-0000-4000-8000-00000000000a','00000000-0000-4000-8000-00000000000a','PRIVATE','BILL','prior bill',10,now()),
 ('22222222-2222-4222-8222-222222222221','00000000-0000-4000-8000-00000000000a','00000000-0000-4000-8000-00000000000a','PRIVATE','BILL','next bill',10,null);
insert into public.finance_recurrence_instances(paid_record_id,next_record_id) values ('22222222-2222-4222-8222-222222222220','22222222-2222-4222-8222-222222222221');
insert into public.chore_completions(id,chore_id,completed_by,note) values ('33333333-3333-4333-8333-333333333333','00000000-0000-4000-8000-0000000000c1','00000000-0000-4000-8000-00000000000a','signed history');
create temp table signed_test(v jsonb); grant select,insert on signed_test to authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
insert into signed_test select public.mobile_signed_export_snapshot();
reset role;
delete from public.task_recurrence_instances where completed_task_id='11111111-1111-4111-8111-111111111110';
delete from public.finance_recurrence_instances where paid_record_id='22222222-2222-4222-8222-222222222220';
delete from public.chore_completions where id='33333333-3333-4333-8333-333333333333';
set local role authenticated;
do $$ declare signed jsonb; forged jsonb; result jsonb; begin
 select v into signed from signed_test;
 forged:=jsonb_set(signed->'payload','{snapshot,tables,task_recurrence_instances,0,next_task_id}','"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"'::jsonb);
 begin perform public.mobile_restore_signed_history(forged,signed->>'signature'); raise exception 'forged history accepted'; exception when others then if sqlerrm<>'INVALID_BACKUP_SIGNATURE' then raise; end if; end;
 result:=public.mobile_restore_signed_history(signed->'payload',signed->>'signature');
 if (result->>'inserted')::int<>3 or not exists(select 1 from public.finance_recurrence_instances where paid_record_id='22222222-2222-4222-8222-222222222220') or not exists(select 1 from public.chore_completions where id='33333333-3333-4333-8333-333333333333') or not exists(select 1 from public.task_recurrence_instances where completed_task_id='11111111-1111-4111-8111-111111111110') then raise exception 'signed history not restored'; end if;
 result:=public.mobile_restore_signed_history(signed->'payload',signed->>'signature');
 if (result->>'inserted')::int<>0 then raise exception 'signed history not idempotent'; end if;
 perform set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}',true);
 begin perform public.mobile_restore_signed_history(signed->'payload',signed->>'signature'); raise exception 'cross-user history accepted'; exception when others then if sqlerrm<>'INVALID_BACKUP_SIGNATURE' then raise; end if; end;
 if has_function_privilege('anon','public.mobile_restore_signed_history(jsonb,text)','execute') then raise exception 'anon history restore allowed'; end if;
end $$;
reset role;
-- Access may be revoked after the backup was signed. Restoring it must not
-- reactivate the member or insert a now-inaccessible household history row.
delete from public.chore_completions where id='33333333-3333-4333-8333-333333333333';
update public.household_members set left_at=now() where user_id='00000000-0000-4000-8000-00000000000a' and left_at is null;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);
set local role authenticated;
do $$ declare signed jsonb; begin
 select v into signed from signed_test;
 begin perform public.mobile_restore_signed_history(signed->'payload',signed->>'signature'); raise exception 'revoked access accepted'; exception when others then if sqlerrm<>'BACKUP_PARENT_NOT_ACCESSIBLE' then raise; end if; end;
end $$;
rollback;

-- A signed household copy has a fresh scope, only the caller as owner, and is
-- idempotent. It must never revive old Storage access or another membership.
begin;
insert into auth.users(id,email) values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','copy@example.com'),('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','member@example.com');
insert into public.households(id,name,created_by) values ('ffffffff-ffff-4fff-8fff-ffffffffffff','old home','dddddddd-dddd-4ddd-8ddd-dddddddddddd');
insert into public.household_members(household_id,user_id,role) values ('ffffffff-ffff-4fff-8fff-ffffffffffff','dddddddd-dddd-4ddd-8ddd-dddddddddddd','OWNER'),('ffffffff-ffff-4fff-8fff-ffffffffffff','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','MEMBER');
insert into storage.objects(bucket_id,name) values ('documents','household/ffffffff-ffff-4fff-8fff-ffffffffffff/old/file.pdf');
create temp table copy_signed(v jsonb); grant select,insert on copy_signed to authenticated;
select set_config('request.jwt.claims','{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}',true);
set local role authenticated;
insert into copy_signed select public.mobile_signed_export_snapshot();
reset role;
delete from public.households where id='ffffffff-ffff-4fff-8fff-ffffffffffff';
set local role authenticated;
do $$ declare v jsonb; new_home uuid; second_home uuid; begin
 select copy_signed.v into v from copy_signed;
 begin perform public.mobile_recover_household_copy(jsonb_set(v->'payload','{snapshot,tables,households,0,name}','"forged"'::jsonb),v->>'signature','ffffffff-ffff-4fff-8fff-ffffffffffff'); raise exception 'forged home accepted'; exception when others then if sqlerrm<>'INVALID_BACKUP_SIGNATURE' then raise; end if; end;
 new_home:=public.mobile_recover_household_copy(v->'payload',v->>'signature','ffffffff-ffff-4fff-8fff-ffffffffffff');
 if new_home='ffffffff-ffff-4fff-8fff-ffffffffffff' then raise exception 'old storage scope reused'; end if;
 second_home:=public.mobile_recover_household_copy(v->'payload',v->>'signature','ffffffff-ffff-4fff-8fff-ffffffffffff');
 if new_home<>second_home or not public.is_household_owner(new_home) then raise exception 'house copy not idempotent'; end if;
 if (select count(*) from public.household_members where household_id=new_home)<>1 then raise exception 'other membership reactivated'; end if;
 if exists(select 1 from storage.objects where name='household/ffffffff-ffff-4fff-8fff-ffffffffffff/old/file.pdf') then raise exception 'old storage scope accessible'; end if;
 perform set_config('request.jwt.claims','{"sub":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","role":"authenticated"}',true);
 begin perform public.mobile_recover_household_copy(v->'payload',v->>'signature','ffffffff-ffff-4fff-8fff-ffffffffffff'); raise exception 'cross-account house accepted'; exception when others then if sqlerrm<>'INVALID_BACKUP_SIGNATURE' then raise; end if; end;
 if has_function_privilege('anon','public.mobile_recover_household_copy(jsonb,text,uuid)','execute') then raise exception 'anon house recovery allowed'; end if;
end $$;
rollback;
