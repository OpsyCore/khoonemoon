-- Minimal, version-guarded edit; untouched rotation rows and schedule are preserved.
create or replace function public.mobile_patch_chore(p_id uuid, p_patch jsonb, p_expected_updated_at timestamptz)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  c public.chores%rowtype; key text; members uuid[]; prior uuid[]; member uuid; pos integer:=0;
  mode public.chore_rotation_mode; freq public.task_recurrence_frequency; days integer[]; n integer;
begin
  if auth.uid() is null or p_expected_updated_at is null then raise exception 'INVALID_VERSION'; end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or p_patch='{}'::jsonb then raise exception 'INVALID_PATCH'; end if;
  for key in select jsonb_object_keys(p_patch) loop
    if key not in ('title','description','rotationMode','assigneeIds','frequency','intervalDays','weekdays','nextDueAt','recurrenceTimezone') then raise exception 'INVALID_PATCH'; end if;
  end loop;
  select * into c from public.chores where id=p_id and archived_at is null for update;
  if not found or c.updated_at is distinct from p_expected_updated_at then raise exception 'STALE_CHORE'; end if;
  if p_patch ? 'title' and (jsonb_typeof(p_patch->'title') <> 'string' or length(btrim(p_patch->>'title')) not between 2 and 180) then raise exception 'INVALID_TITLE'; end if;
  if p_patch ? 'description' and (jsonb_typeof(p_patch->'description') not in ('string','null') or length(p_patch->>'description') > 2000) then raise exception 'INVALID_DESCRIPTION'; end if;
  if p_patch ? 'rotationMode' and jsonb_typeof(p_patch->'rotationMode') <> 'string' then raise exception 'INVALID_MODE'; end if;
  if p_patch ? 'frequency' and jsonb_typeof(p_patch->'frequency') <> 'string' then raise exception 'INVALID_FREQUENCY'; end if;
  if p_patch ? 'intervalDays' and jsonb_typeof(p_patch->'intervalDays') not in ('number','null') then raise exception 'INVALID_INTERVAL'; end if;
  if p_patch ? 'weekdays' and jsonb_typeof(p_patch->'weekdays') not in ('array','null') then raise exception 'INVALID_WEEKDAYS'; end if;
  if p_patch ? 'nextDueAt' and jsonb_typeof(p_patch->'nextDueAt') not in ('string','null') then raise exception 'INVALID_DUE'; end if;
  if p_patch ? 'recurrenceTimezone' and (jsonb_typeof(p_patch->'recurrenceTimezone') <> 'string' or not exists(select 1 from pg_timezone_names where name=p_patch->>'recurrenceTimezone')) then raise exception 'INVALID_TIMEZONE'; end if;
  mode := coalesce(p_patch->>'rotationMode',c.rotation_mode::text)::public.chore_rotation_mode;
  freq := coalesce(p_patch->>'frequency',c.frequency::text)::public.task_recurrence_frequency;
  if freq='INTERVAL_DAYS' and coalesce(case when p_patch ? 'intervalDays' then (p_patch->>'intervalDays')::integer else c.interval_days end,0) not between 1 and 365 then raise exception 'INVALID_INTERVAL'; end if;
  if p_patch ? 'intervalDays' and p_patch->>'intervalDays' is not null and (p_patch->>'intervalDays')::integer not between 1 and 365 then raise exception 'INVALID_INTERVAL'; end if;
  if p_patch ? 'weekdays' and jsonb_typeof(p_patch->'weekdays')='array' then
    select coalesce(array_agg(value::integer),array[]::integer[]) into days from jsonb_array_elements_text(p_patch->'weekdays');
    if exists(select 1 from unnest(days) d where d < 0 or d > 6) then raise exception 'INVALID_WEEKDAYS'; end if;
  end if;
  select coalesce(array_agg(assignee_id order by position),array[]::uuid[]) into prior from public.chore_rotation_steps where chore_id=p_id;
  members := prior;
  if p_patch ? 'assigneeIds' then
    if jsonb_typeof(p_patch->'assigneeIds') <> 'array' then raise exception 'INVALID_ASSIGNEES'; end if;
    select coalesce(array_agg(value::uuid),array[]::uuid[]) into members from jsonb_array_elements_text(p_patch->'assigneeIds');
    if cardinality(members)=0 then members:=array[auth.uid()]; end if;
  end if;
  if p_patch ? 'assigneeIds' or p_patch ? 'rotationMode' then
    if cardinality(members)>10 or (mode='ROTATING' and cardinality(members)<2) or cardinality(members)<>(select count(distinct x) from unnest(members) x) then raise exception 'INVALID_ASSIGNEES'; end if;
    foreach member in array members loop
      if not exists(select 1 from public.household_members where household_id=c.household_id and user_id=member and left_at is null) then raise exception 'INVALID_ASSIGNEES'; end if;
    end loop;
  end if;
  update public.chores set
    title=case when p_patch ? 'title' then btrim(p_patch->>'title') else title end,
    description=case when p_patch ? 'description' then nullif(btrim(p_patch->>'description'),'') else description end,
    rotation_mode=mode, frequency=freq,
    interval_days=case when p_patch ? 'intervalDays' then (p_patch->>'intervalDays')::integer else interval_days end,
    weekdays=case when p_patch ? 'weekdays' then nullif(days,array[]::integer[]) else weekdays end,
    next_due_at=case when p_patch ? 'nextDueAt' then (p_patch->>'nextDueAt')::timestamptz else next_due_at end,
    recurrence_timezone=case when p_patch ? 'recurrenceTimezone' then p_patch->>'recurrenceTimezone' else recurrence_timezone end,
    current_rotation_index=case when members is distinct from prior then 0 else current_rotation_index end
  where id=p_id and archived_at is null;
  get diagnostics n=row_count; if n<>1 then raise exception 'CHORE_NOT_FOUND_OR_FORBIDDEN'; end if;
  if p_patch ? 'assigneeIds' and members is distinct from prior then
    delete from public.chore_rotation_steps where chore_id=p_id;
    foreach member in array members loop
      insert into public.chore_rotation_steps(chore_id,position,assignee_id) values(p_id,pos,member); pos:=pos+1;
    end loop;
  end if;
  return p_id;
end $$;
revoke all on function public.mobile_patch_chore(uuid,jsonb,timestamptz) from public,anon;
grant execute on function public.mobile_patch_chore(uuid,jsonb,timestamptz) to authenticated;
