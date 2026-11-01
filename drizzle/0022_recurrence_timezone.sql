-- A recurrence keeps the creator's IANA zone at creation. Existing schedules
-- inherit the creator's current profile zone; invalid historic values use UTC.
-- This changes no existing due date and does not fabricate missed occurrences.
alter table public.chores add column if not exists recurrence_timezone text;
alter table public.task_recurrences add column if not exists recurrence_timezone text;

create or replace function public.next_zoned_recurrence(
  p_from timestamptz, p_frequency public.task_recurrence_frequency,
  p_interval_days integer, p_weekdays integer[], p_timezone text
) returns timestamptz language plpgsql stable set search_path = pg_catalog, public as $$
declare base timestamp; candidate timestamp; offset_days integer;
begin
  if p_from is null or not exists(select 1 from pg_timezone_names where name=p_timezone) then
    raise exception 'INVALID_RECURRENCE_TIMEZONE';
  end if;
  base := p_from at time zone p_timezone;
  case p_frequency
    when 'NONE' then return null;
    when 'DAILY' then candidate := base + interval '1 day';
    when 'INTERVAL_DAYS' then candidate := base + make_interval(days => greatest(coalesce(p_interval_days,1),1));
    when 'MONTHLY' then candidate := base + interval '1 month';
    when 'YEARLY' then candidate := base + interval '1 year';
    when 'WEEKLY' then
      if p_weekdays is null or cardinality(p_weekdays)=0 then candidate := base + interval '7 days';
      else
        for offset_days in 1..7 loop
          candidate := base + make_interval(days => offset_days);
          exit when extract(dow from candidate)::integer = any(p_weekdays);
        end loop;
      end if;
    else return null;
  end case;
  return candidate at time zone p_timezone;
end $$;

-- Resolve once per schedule, independent of the person completing it later.
create or replace function public.set_recurrence_timezone() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
declare creator uuid; z text; due timestamptz;
begin
  if tg_table_name = 'chores' then creator := new.created_by;
  else select creator_id, due_at into creator, due from public.tasks where id=new.task_id;
  end if;
  if new.recurrence_timezone is null then
    select p.timezone into z from public.profiles p where p.id=creator;
    if not exists(select 1 from pg_timezone_names where name=z) then z := 'UTC'; end if;
    new.recurrence_timezone := z;
  elsif not exists(select 1 from pg_timezone_names where name=new.recurrence_timezone) then
    raise exception 'INVALID_RECURRENCE_TIMEZONE';
  end if;
  if tg_table_name = 'task_recurrences' then
    new.next_occurrence_at := public.next_zoned_recurrence(coalesce(due,now()),new.frequency,new.interval_days,new.weekdays,new.recurrence_timezone);
  end if;
  return new;
end $$;
revoke all on function public.set_recurrence_timezone() from public, anon, authenticated;

-- A second run must not recalculate existing schedules.
drop trigger if exists chore_recurrence_zone on public.chores;
drop trigger if exists task_recurrence_zone on public.task_recurrences;
update public.chores c set recurrence_timezone = coalesce((select p.timezone from public.profiles p where p.id=c.created_by and exists(select 1 from pg_timezone_names t where t.name=p.timezone)), 'UTC') where recurrence_timezone is null;
with zones as (
  select r.id, t.due_at, t.status, coalesce((select p.timezone from public.profiles p where p.id=t.creator_id and exists(select 1 from pg_timezone_names z where z.name=p.timezone)), 'UTC') as zone
  from public.task_recurrences r join public.tasks t on t.id=r.task_id where r.recurrence_timezone is null
)
update public.task_recurrences r
set recurrence_timezone=z.zone,
    next_occurrence_at=case when z.status <> 'COMPLETED' and r.frequency <> 'NONE'
      then public.next_zoned_recurrence(coalesce(z.due_at,now()),r.frequency,r.interval_days,r.weekdays,z.zone)
      else r.next_occurrence_at end
from zones z where r.id=z.id;
alter table public.chores alter column recurrence_timezone set not null;
alter table public.task_recurrences alter column recurrence_timezone set not null;
create trigger chore_recurrence_zone before insert or update of recurrence_timezone on public.chores for each row execute function public.set_recurrence_timezone();
create trigger task_recurrence_zone before insert or update of frequency,interval_days,weekdays,recurrence_timezone on public.task_recurrences for each row execute function public.set_recurrence_timezone();

create or replace function public.complete_chore(p_chore_id uuid)
returns table (
  completion_id uuid,
  next_due_at timestamptz,
  next_assignee_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chore public.chores;
  v_step_count integer;
  v_next_index integer;
  v_assignee uuid;
  v_completion_id uuid;
  v_next_due timestamptz;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_chore from public.chores where id = p_chore_id for update;

  if v_chore.id is null then
    raise exception 'CHORE_NOT_FOUND';
  end if;

  if not public.is_household_member(v_chore.household_id) then
    raise exception 'NOT_HOUSEHOLD_MEMBER';
  end if;

  if v_chore.archived_at is not null or not v_chore.is_active then raise exception 'CHORE_INACTIVE'; end if;

  insert into public.chore_completions (chore_id, completed_by, due_at)
  values (p_chore_id, auth.uid(), v_chore.next_due_at)
  returning id into v_completion_id;

  select count(*) into v_step_count
  from public.chore_rotation_steps s
  where s.chore_id = p_chore_id;

  if v_chore.rotation_mode = 'ROTATING' and v_step_count > 0 then
    v_next_index := (v_chore.current_rotation_index + 1) % v_step_count;

    select s.assignee_id into v_assignee
    from public.chore_rotation_steps s
    where s.chore_id = p_chore_id and s.position = v_next_index;
  else
    v_next_index := v_chore.current_rotation_index;

    select s.assignee_id into v_assignee
    from public.chore_rotation_steps s
    where s.chore_id = p_chore_id and s.position = 0;
  end if;

  -- NOTE: `returning next_due_at into ...` would be ambiguous here because the
  -- returned column shares its name with the function's OUT parameter, so the
  -- new value is computed first and stored in a local variable.
  v_next_due := public.next_zoned_recurrence(
    coalesce(v_chore.next_due_at, now()),
    v_chore.frequency,
    v_chore.interval_days,
    v_chore.weekdays,
    v_chore.recurrence_timezone
  );

  update public.chores
  set current_rotation_index = v_next_index,
      next_due_at = v_next_due
  where id = p_chore_id;

  return query select v_completion_id, v_next_due, v_assignee;
end;
$$;

create or replace function public.mobile_complete_task(p_task_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp set timezone = 'UTC' as $$
declare
  task public.tasks%rowtype;
  recurrence public.task_recurrences%rowtype;
  successor uuid;
  next_due timestamptz;
  after_next timestamptz;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.current_user_can_manage_task(p_task_id) then raise exception 'TASK_NOT_FOUND_OR_FORBIDDEN'; end if;
  select * into task from public.tasks where id = p_task_id for update;
  if task.id is null or task.archived_at is not null or not public.current_user_can_manage_task(p_task_id) then raise exception 'TASK_NOT_FOUND_OR_FORBIDDEN'; end if;
  select next_task_id into successor from public.task_recurrence_instances where completed_task_id = task.id;
  if task.status = 'COMPLETED' then return successor; end if;
  update public.tasks set status = 'COMPLETED', completed_at = now() where id = task.id;
  if successor is not null then return successor; end if;
  select * into recurrence from public.task_recurrences where task_id = task.id;
  if recurrence.id is null or recurrence.frequency = 'NONE' then return null; end if;
  next_due := recurrence.next_occurrence_at;
  if next_due is null or (task.due_at is not null and next_due <= task.due_at) then
    next_due := public.next_zoned_recurrence(coalesce(task.due_at, now()), recurrence.frequency, recurrence.interval_days, recurrence.weekdays, recurrence.recurrence_timezone);
  end if;
  if next_due is null then raise exception 'INVALID_RECURRENCE'; end if;
  after_next := public.next_zoned_recurrence(next_due, recurrence.frequency, recurrence.interval_days, recurrence.weekdays, recurrence.recurrence_timezone);
  if after_next is null or after_next <= next_due then raise exception 'INVALID_RECURRENCE'; end if;
  insert into public.tasks(title,description,creator_id,owner_id,household_id,visibility,status,priority,due_at)
  values(task.title,task.description,task.creator_id,task.owner_id,task.household_id,task.visibility,'PENDING',task.priority,next_due)
  returning id into successor;
  insert into public.task_assignees(task_id,assignee_id)
    select successor, a.assignee_id from public.task_assignees a
    where a.task_id = task.id and public.valid_task_assignee(successor,a.assignee_id);
  if not exists(select 1 from public.task_assignees where task_id = successor) then
    insert into public.task_assignees(task_id,assignee_id) values(successor, case when task.visibility = 'PRIVATE' then task.owner_id else auth.uid() end);
  end if;
  insert into public.task_recurrences(task_id,frequency,interval_days,weekdays,next_occurrence_at,recurrence_timezone)
  values(successor,recurrence.frequency,recurrence.interval_days,recurrence.weekdays,after_next,recurrence.recurrence_timezone);
  insert into public.task_recurrence_instances(completed_task_id,next_task_id) values(task.id,successor);
  return successor;
end $$;


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
    insert into public.task_recurrences(task_id, frequency, interval_days, weekdays, next_occurrence_at, recurrence_timezone)
    values(task_id, frequency, (p_input->'recurrence'->>'intervalDays')::integer, nullif(days, array[]::integer[]), nullif(p_input->>'nextOccurrenceAt','')::timestamptz, nullif(p_input->>'recurrenceTimezone',''));
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
  insert into public.chores(household_id,title,description,created_by,rotation_mode,frequency,interval_days,weekdays,next_due_at,recurrence_timezone)
  values(hid,btrim(p_input->>'title'),nullif(btrim(p_input->>'description'),''),uid,mode,frequency,
    (p_input->>'intervalDays')::integer,nullif(days, array[]::integer[]),nullif(p_input->>'nextDueAt','')::timestamptz,nullif(p_input->>'recurrenceTimezone','')) returning id into chore_id;
  foreach assignee in array assignees loop
    insert into public.chore_rotation_steps(chore_id,position,assignee_id) values(chore_id,position,assignee);
    position := position + 1;
  end loop;
  return chore_id;
end $$;


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
    insert into public.task_recurrences(task_id,frequency,interval_days,weekdays,next_occurrence_at,recurrence_timezone)
    values(p_id,v_frequency,(p_input->'recurrence'->>'intervalDays')::integer,nullif(days,array[]::integer[]),nullif(p_input->>'nextOccurrenceAt','')::timestamptz,nullif(p_input->>'recurrenceTimezone',''));
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
    next_due_at=nullif(p_input->>'nextDueAt','')::timestamptz,recurrence_timezone=coalesce(nullif(p_input->>'recurrenceTimezone',''),recurrence_timezone),current_rotation_index=case when previous_assignees is distinct from assignees then 0 else current_rotation_index end
  where id=p_id and archived_at is null;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'CHORE_NOT_FOUND_OR_FORBIDDEN'; end if;
  delete from public.chore_rotation_steps where chore_id=p_id;
  foreach assignee in array assignees loop
    insert into public.chore_rotation_steps(chore_id,position,assignee_id) values(p_id,pos,assignee); pos := pos + 1;
  end loop;
  return p_id;
end $$;
