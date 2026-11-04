-- Atomic mobile creation. SECURITY INVOKER retains the caller's RLS policies.
-- Never accept creator/owner/household identity from the client.
create or replace function public.mobile_create_task(p_input jsonb)
returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid(); hid uuid; task_id uuid; assignee uuid;
  assignees uuid[]; days integer[];
  visibility public.task_visibility; frequency public.task_recurrence_frequency;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if length(btrim(coalesce(p_input->>'title',''))) not between 2 and 180 then raise exception 'INVALID_TITLE'; end if;
  visibility := (p_input->>'visibility')::public.task_visibility;
  frequency := coalesce(p_input->'recurrence'->>'frequency', 'NONE')::public.task_recurrence_frequency;
  if visibility is null then raise exception 'INVALID_VISIBILITY'; end if;
  if visibility = 'HOUSEHOLD_SHARED' then
    select household_id into hid from public.household_members where user_id = uid and left_at is null;
    if hid is null then raise exception 'NO_HOUSEHOLD'; end if;
  end if;
  select coalesce(array_agg(value::uuid), array[]::uuid[]) into assignees from jsonb_array_elements_text(coalesce(p_input->'assigneeIds', '[]'::jsonb));
  if cardinality(assignees) = 0 then assignees := array[uid]; end if;
  if cardinality(assignees) > 10 or cardinality(assignees) <> (select count(distinct x) from unnest(assignees) x) then raise exception 'INVALID_ASSIGNEES'; end if;
  foreach assignee in array assignees loop
    if visibility = 'PRIVATE' and assignee <> uid then raise exception 'INVALID_ASSIGNEES'; end if;
    if visibility = 'HOUSEHOLD_SHARED' and not exists(select 1 from public.household_members where household_id = hid and user_id = assignee and left_at is null) then raise exception 'INVALID_ASSIGNEES'; end if;
  end loop;
  select coalesce(array_agg(value::integer), array[]::integer[]) into days from jsonb_array_elements_text(case when jsonb_typeof(p_input->'recurrence'->'weekdays') = 'array' then p_input->'recurrence'->'weekdays' else '[]'::jsonb end);
  if exists(select 1 from unnest(days) d where d < 0 or d > 6) then raise exception 'INVALID_WEEKDAYS'; end if;
  if frequency = 'WEEKLY' and cardinality(days) = 0 then raise exception 'INVALID_WEEKDAYS'; end if;
  if frequency = 'INTERVAL_DAYS' and coalesce((p_input->'recurrence'->>'intervalDays')::integer, 0) not between 1 and 365 then raise exception 'INVALID_INTERVAL'; end if;
  insert into public.tasks(title, description, creator_id, owner_id, household_id, visibility, status, priority, due_at)
  values(btrim(p_input->>'title'), nullif(btrim(p_input->>'description'), ''), uid, uid, hid, visibility,
    coalesce((p_input->>'status')::public.task_status, 'PENDING'), coalesce((p_input->>'priority')::public.task_priority, 'NORMAL'),
    nullif(p_input->>'dueAt','')::timestamptz) returning id into task_id;
  foreach assignee in array assignees loop
    insert into public.task_assignees(task_id, assignee_id) values(task_id, assignee);
  end loop;
  if frequency <> 'NONE' then
    insert into public.task_recurrences(task_id, frequency, interval_days, weekdays, next_occurrence_at)
    values(task_id, frequency, (p_input->'recurrence'->>'intervalDays')::integer, nullif(days, array[]::integer[]), nullif(p_input->>'nextOccurrenceAt','')::timestamptz);
  end if;
  return task_id;
end $$;

create or replace function public.mobile_create_chore(p_input jsonb)
returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid(); hid uuid; chore_id uuid; assignee uuid; position integer := 0;
  assignees uuid[]; days integer[]; frequency public.task_recurrence_frequency; mode public.chore_rotation_mode;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select household_id into hid from public.household_members where user_id = uid and left_at is null;
  if hid is null then raise exception 'NO_HOUSEHOLD'; end if;
  if length(btrim(coalesce(p_input->>'title',''))) not between 2 and 180 then raise exception 'INVALID_TITLE'; end if;
  frequency := coalesce(p_input->>'frequency','WEEKLY')::public.task_recurrence_frequency;
  mode := coalesce(p_input->>'rotationMode','FIXED')::public.chore_rotation_mode;
  select coalesce(array_agg(value::uuid), array[]::uuid[]) into assignees from jsonb_array_elements_text(coalesce(p_input->'assigneeIds','[]'::jsonb));
  if cardinality(assignees) = 0 then assignees := array[uid]; end if;
  if cardinality(assignees) > 10 or (mode = 'ROTATING' and cardinality(assignees) < 2) or cardinality(assignees) <> (select count(distinct x) from unnest(assignees) x) then raise exception 'INVALID_ASSIGNEES'; end if;
  foreach assignee in array assignees loop
    if not exists(select 1 from public.household_members where household_id = hid and user_id = assignee and left_at is null) then raise exception 'INVALID_ASSIGNEES'; end if;
  end loop;
  select coalesce(array_agg(value::integer), array[]::integer[]) into days from jsonb_array_elements_text(case when jsonb_typeof(p_input->'weekdays') = 'array' then p_input->'weekdays' else '[]'::jsonb end);
  if exists(select 1 from unnest(days) d where d < 0 or d > 6) then raise exception 'INVALID_WEEKDAYS'; end if;
  if frequency = 'INTERVAL_DAYS' and coalesce((p_input->>'intervalDays')::integer,0) not between 1 and 365 then raise exception 'INVALID_INTERVAL'; end if;
  insert into public.chores(household_id,title,description,created_by,rotation_mode,frequency,interval_days,weekdays,next_due_at)
  values(hid,btrim(p_input->>'title'),nullif(btrim(p_input->>'description'),''),uid,mode,frequency,
    (p_input->>'intervalDays')::integer,nullif(days, array[]::integer[]),nullif(p_input->>'nextDueAt','')::timestamptz) returning id into chore_id;
  foreach assignee in array assignees loop
    insert into public.chore_rotation_steps(chore_id,position,assignee_id) values(chore_id,position,assignee);
    position := position + 1;
  end loop;
  return chore_id;
end $$;
revoke all on function public.mobile_create_task(jsonb) from public, anon;
revoke all on function public.mobile_create_chore(jsonb) from public, anon;
grant execute on function public.mobile_create_task(jsonb) to authenticated;
grant execute on function public.mobile_create_chore(jsonb) to authenticated;
