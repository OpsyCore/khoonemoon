-- Update a task and its assignments/recurrence in one transaction under RLS.
create or replace function public.mobile_update_task(p_id uuid, p_input jsonb)
returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid(); hid uuid; owner uuid; assignee uuid; assignees uuid[]; days integer[];
  v_visibility public.task_visibility; v_frequency public.task_recurrence_frequency; affected integer;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select owner_id into owner from public.tasks where id = p_id and archived_at is null;
  if owner is null then raise exception 'TASK_NOT_FOUND'; end if;
  if length(btrim(coalesce(p_input->>'title',''))) not between 2 and 180 then raise exception 'INVALID_TITLE'; end if;
  v_visibility := (p_input->>'visibility')::public.task_visibility;
  if v_visibility is null then raise exception 'INVALID_VISIBILITY'; end if;
  v_frequency := coalesce(p_input->'recurrence'->>'frequency','NONE')::public.task_recurrence_frequency;
  if v_visibility = 'HOUSEHOLD_SHARED' then
    select household_id into hid from public.household_members where user_id = uid and left_at is null;
    if hid is null then raise exception 'NO_HOUSEHOLD'; end if;
  end if;
  select coalesce(array_agg(value::uuid),array[]::uuid[]) into assignees from jsonb_array_elements_text(coalesce(p_input->'assigneeIds','[]'::jsonb));
  if cardinality(assignees) = 0 then assignees := array[owner]; end if;
  if cardinality(assignees) > 10 or cardinality(assignees) <> (select count(distinct x) from unnest(assignees) x) then raise exception 'INVALID_ASSIGNEES'; end if;
  foreach assignee in array assignees loop
    if v_visibility = 'PRIVATE' and assignee <> owner then raise exception 'INVALID_ASSIGNEES'; end if;
    if v_visibility = 'HOUSEHOLD_SHARED' and not exists(select 1 from public.household_members where household_id = hid and user_id = assignee and left_at is null) then raise exception 'INVALID_ASSIGNEES'; end if;
  end loop;
  select coalesce(array_agg(value::integer),array[]::integer[]) into days from jsonb_array_elements_text(case when jsonb_typeof(p_input->'recurrence'->'weekdays') = 'array' then p_input->'recurrence'->'weekdays' else '[]'::jsonb end);
  if exists(select 1 from unnest(days) d where d < 0 or d > 6) or (v_frequency = 'WEEKLY' and cardinality(days)=0) then raise exception 'INVALID_WEEKDAYS'; end if;
  if v_frequency = 'INTERVAL_DAYS' and coalesce((p_input->'recurrence'->>'intervalDays')::integer,0) not between 1 and 365 then raise exception 'INVALID_INTERVAL'; end if;
  update public.tasks set title=btrim(p_input->>'title'), description=nullif(btrim(p_input->>'description'),''), household_id=hid, visibility=v_visibility,
    priority=coalesce((p_input->>'priority')::public.task_priority, 'NORMAL'), due_at=nullif(p_input->>'dueAt','')::timestamptz
  where id=p_id and archived_at is null;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'TASK_NOT_FOUND_OR_FORBIDDEN'; end if;
  delete from public.task_assignees where task_id=p_id;
  foreach assignee in array assignees loop insert into public.task_assignees(task_id,assignee_id) values(p_id,assignee); end loop;
  delete from public.task_recurrences where task_id=p_id;
  if v_frequency <> 'NONE' then
    insert into public.task_recurrences(task_id,frequency,interval_days,weekdays,next_occurrence_at)
    values(p_id,v_frequency,(p_input->'recurrence'->>'intervalDays')::integer,nullif(days,array[]::integer[]),nullif(p_input->>'nextOccurrenceAt','')::timestamptz);
  end if;
  return p_id;
end $$;

create or replace function public.mobile_update_chore(p_id uuid, p_input jsonb)
returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid(); hid uuid; assignee uuid; pos integer := 0; assignees uuid[]; days integer[];
  v_frequency public.task_recurrence_frequency; mode public.chore_rotation_mode; affected integer; previous_assignees uuid[];
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select household_id into hid from public.chores where id=p_id and archived_at is null;
  if hid is null then raise exception 'CHORE_NOT_FOUND'; end if;
  if length(btrim(coalesce(p_input->>'title',''))) not between 2 and 180 then raise exception 'INVALID_TITLE'; end if;
  v_frequency := coalesce(p_input->>'frequency','WEEKLY')::public.task_recurrence_frequency;
  mode := coalesce(p_input->>'rotationMode','FIXED')::public.chore_rotation_mode;
  select coalesce(array_agg(value::uuid),array[]::uuid[]) into assignees from jsonb_array_elements_text(coalesce(p_input->'assigneeIds','[]'::jsonb));
  if cardinality(assignees)=0 then assignees := array[uid]; end if;
  if cardinality(assignees)>10 or (mode='ROTATING' and cardinality(assignees)<2) or cardinality(assignees) <> (select count(distinct x) from unnest(assignees) x) then raise exception 'INVALID_ASSIGNEES'; end if;
  foreach assignee in array assignees loop
    if not exists(select 1 from public.household_members where household_id=hid and user_id=assignee and left_at is null) then raise exception 'INVALID_ASSIGNEES'; end if;
  end loop;
  select coalesce(array_agg(value::integer),array[]::integer[]) into days from jsonb_array_elements_text(case when jsonb_typeof(p_input->'weekdays') = 'array' then p_input->'weekdays' else '[]'::jsonb end);
  if exists(select 1 from unnest(days) d where d < 0 or d > 6) then raise exception 'INVALID_WEEKDAYS'; end if;
  if v_frequency='INTERVAL_DAYS' and coalesce((p_input->>'intervalDays')::integer,0) not between 1 and 365 then raise exception 'INVALID_INTERVAL'; end if;
  select array_agg(assignee_id order by position) into previous_assignees from public.chore_rotation_steps where chore_id=p_id;
  update public.chores set title=btrim(p_input->>'title'),description=nullif(btrim(p_input->>'description'),''),rotation_mode=mode,
    frequency=v_frequency,interval_days=(p_input->>'intervalDays')::integer,weekdays=nullif(days,array[]::integer[]),
    next_due_at=nullif(p_input->>'nextDueAt','')::timestamptz,current_rotation_index=case when previous_assignees is distinct from assignees then 0 else current_rotation_index end
  where id=p_id and archived_at is null;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'CHORE_NOT_FOUND_OR_FORBIDDEN'; end if;
  delete from public.chore_rotation_steps where chore_id=p_id;
  foreach assignee in array assignees loop
    insert into public.chore_rotation_steps(chore_id,position,assignee_id) values(p_id,pos,assignee); pos := pos + 1;
  end loop;
  return p_id;
end $$;
revoke all on function public.mobile_update_task(uuid,jsonb) from public, anon;
revoke all on function public.mobile_update_chore(uuid,jsonb) from public, anon;
grant execute on function public.mobile_update_task(uuid,jsonb) to authenticated;
grant execute on function public.mobile_update_chore(uuid,jsonb) to authenticated;
