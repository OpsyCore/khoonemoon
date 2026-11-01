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
