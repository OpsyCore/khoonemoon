-- Parts 3-7: Jalali occasions on events, cleaning on tasks, document expiry &
-- renewals, household appliances & maintenance, and v2-compatible central reminders.

-- ---------------------------------------------------------------------------
-- 1. Occasions & Jalali annual recurrence on public.events (Part 3)
-- ---------------------------------------------------------------------------
alter table public.events
  add column if not exists occasion_type text,
  add column if not exists recurrence_calendar text,
  add column if not exists jalali_month smallint,
  add column if not exists jalali_day smallint,
  add column if not exists gift_idea text,
  add column if not exists occasion_plan text;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.events'::regclass and conname = 'events_occasion_fields_check') then
    alter table public.events add constraint events_occasion_fields_check check (
      (occasion_type is null or occasion_type in ('BIRTHDAY', 'ANNIVERSARY', 'PERSONAL'))
      and (recurrence_calendar is null or recurrence_calendar in ('JALALI_YEARLY'))
      and (
        (recurrence_calendar is null and jalali_month is null and jalali_day is null)
        or (
          recurrence_calendar = 'JALALI_YEARLY'
          and jalali_month between 1 and 12
          and jalali_day between 1 and 31
          and (jalali_month <= 6 or jalali_day <= 30)
        )
      )
      and (gift_idea is null or char_length(gift_idea) <= 500)
      and (occasion_plan is null or char_length(occasion_plan) <= 1000)
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Cleaning & occasion task links on public.tasks (Part 3 & Part 4)
-- ---------------------------------------------------------------------------
create or replace function public.valid_cleaning_checklist(p_items jsonb)
returns boolean language plpgsql immutable strict set search_path = pg_catalog, public, pg_temp as $$
declare item jsonb;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 30 then
    return false;
  end if;
  for item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(item) <> 'object'
       or jsonb_typeof(item->'id') <> 'string'
       or char_length(btrim(item->>'id')) not between 1 and 64
       or jsonb_typeof(item->'title') <> 'string'
       or char_length(btrim(item->>'title')) not between 1 and 160
       or jsonb_typeof(item->'done') <> 'boolean' then
      return false;
    end if;
  end loop;
  return true;
end $$;
revoke all on function public.valid_cleaning_checklist(jsonb) from public, anon;
grant execute on function public.valid_cleaning_checklist(jsonb) to authenticated;

alter table public.tasks
  add column if not exists task_kind text not null default 'GENERAL',
  add column if not exists cleaning_zone text,
  add column if not exists cleaning_checklist jsonb not null default '[]'::jsonb,
  add column if not exists source_event_id uuid references public.events(id) on delete set null,
  add column if not exists source_occurrence_year smallint;

create index if not exists tasks_source_event_id_idx on public.tasks (source_event_id);
create unique index if not exists tasks_owner_source_event_year_uniq
  on public.tasks (owner_id, source_event_id, coalesce(source_occurrence_year, 0))
  where source_event_id is not null and archived_at is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.tasks'::regclass and conname = 'tasks_cleaning_and_source_check') then
    alter table public.tasks add constraint tasks_cleaning_and_source_check check (
      task_kind in ('GENERAL', 'CLEANING')
      and (cleaning_zone is null or cleaning_zone in ('KITCHEN', 'BEDROOM', 'LIVING_ROOM', 'RESTROOM', 'BATHROOM', 'BALCONY', 'STORAGE', 'OTHER'))
      and public.valid_cleaning_checklist(cleaning_checklist)
      and (source_occurrence_year is null or source_occurrence_year between 1200 and 1600)
    );
  end if;
end $$;

create or replace function public.mobile_create_task(p_input jsonb)
returns uuid language plpgsql security invoker set search_path = pg_catalog, public, pg_temp as $$
declare
  uid uuid := auth.uid(); hid uuid; task_id uuid; assignee uuid;
  assignees uuid[]; days integer[];
  visibility public.task_visibility; frequency public.task_recurrence_frequency;
  v_kind text; v_zone text; v_checklist jsonb; v_source_event uuid; v_source_year smallint;
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
  v_kind := coalesce(nullif(btrim(p_input->>'taskKind'), ''), 'GENERAL');
  v_zone := nullif(btrim(p_input->>'cleaningZone'), '');
  v_checklist := coalesce(p_input->'cleaningChecklist', '[]'::jsonb);
  if v_kind not in ('GENERAL', 'CLEANING') or not public.valid_cleaning_checklist(v_checklist) then
    raise exception 'INVALID_CLEANING_DATA';
  end if;
  v_source_event := nullif(btrim(p_input->>'sourceEventId'), '')::uuid;
  v_source_year := nullif(btrim(p_input->>'sourceOccurrenceYear'), '')::smallint;
  if v_source_event is not null then
    if not public.current_user_can_access_event(v_source_event) then
      raise exception 'EVENT_NOT_FOUND_OR_FORBIDDEN';
    end if;
    select t.id into task_id from public.tasks t
    where t.owner_id = uid and t.source_event_id = v_source_event
      and coalesce(t.source_occurrence_year, 0) = coalesce(v_source_year, 0)
      and t.archived_at is null
    limit 1;
    if task_id is not null then return task_id; end if;
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
  insert into public.tasks(title, description, creator_id, owner_id, household_id, visibility, status, priority, due_at, task_kind, cleaning_zone, cleaning_checklist, source_event_id, source_occurrence_year)
  values(btrim(p_input->>'title'), nullif(btrim(p_input->>'description'), ''), uid, uid, hid, visibility,
    coalesce((p_input->>'status')::public.task_status, 'PENDING'), coalesce((p_input->>'priority')::public.task_priority, 'NORMAL'),
    nullif(p_input->>'dueAt','')::timestamptz, v_kind, v_zone, v_checklist, v_source_event, v_source_year)
  returning id into task_id;
  foreach assignee in array assignees loop
    insert into public.task_assignees(task_id, assignee_id) values(task_id, assignee);
  end loop;
  if frequency <> 'NONE' then
    insert into public.task_recurrences(task_id, frequency, interval_days, weekdays, next_occurrence_at, recurrence_timezone)
    values(task_id, frequency, (p_input->'recurrence'->>'intervalDays')::integer, nullif(days, array[]::integer[]), nullif(p_input->>'nextOccurrenceAt','')::timestamptz, nullif(btrim(p_input->>'recurrenceTimezone'), ''));
  end if;
  return task_id;
end $$;
revoke all on function public.mobile_create_task(jsonb) from public, anon;
grant execute on function public.mobile_create_task(jsonb) to authenticated;

create or replace function public.mobile_update_task(p_id uuid, p_input jsonb)
returns uuid language plpgsql security invoker set search_path = pg_catalog, public, pg_temp as $$
declare
  uid uuid := auth.uid(); hid uuid; owner uuid; assignee uuid; assignees uuid[]; days integer[];
  v_visibility public.task_visibility; v_frequency public.task_recurrence_frequency; affected integer;
  v_kind text; v_zone text; v_checklist jsonb;
  existing_kind text; existing_zone text; existing_checklist jsonb;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select owner_id, task_kind, cleaning_zone, cleaning_checklist
    into owner, existing_kind, existing_zone, existing_checklist
    from public.tasks where id = p_id and archived_at is null;
  if owner is null then raise exception 'TASK_NOT_FOUND'; end if;
  if length(btrim(coalesce(p_input->>'title',''))) not between 2 and 180 then raise exception 'INVALID_TITLE'; end if;
  v_visibility := (p_input->>'visibility')::public.task_visibility;
  if v_visibility is null then raise exception 'INVALID_VISIBILITY'; end if;
  v_frequency := coalesce(p_input->'recurrence'->>'frequency','NONE')::public.task_recurrence_frequency;
  if v_visibility = 'HOUSEHOLD_SHARED' then
    select household_id into hid from public.household_members where user_id = uid and left_at is null;
    if hid is null then raise exception 'NO_HOUSEHOLD'; end if;
  end if;
  v_kind := case when p_input ? 'taskKind' then coalesce(nullif(btrim(p_input->>'taskKind'), ''), 'GENERAL') else existing_kind end;
  v_zone := case when p_input ? 'cleaningZone' then nullif(btrim(p_input->>'cleaningZone'), '') else existing_zone end;
  v_checklist := case when p_input ? 'cleaningChecklist' then coalesce(p_input->'cleaningChecklist', '[]'::jsonb) else existing_checklist end;
  if v_kind not in ('GENERAL', 'CLEANING') or not public.valid_cleaning_checklist(v_checklist) then
    raise exception 'INVALID_CLEANING_DATA';
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
    priority=coalesce((p_input->>'priority')::public.task_priority, 'NORMAL'), due_at=nullif(p_input->>'dueAt','')::timestamptz,
    task_kind=v_kind, cleaning_zone=v_zone, cleaning_checklist=v_checklist
  where id=p_id and archived_at is null;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'TASK_NOT_FOUND_OR_FORBIDDEN'; end if;
  delete from public.task_assignees where task_id=p_id;
  foreach assignee in array assignees loop insert into public.task_assignees(task_id,assignee_id) values(p_id,assignee); end loop;
  delete from public.task_recurrences where task_id=p_id;
  if v_frequency <> 'NONE' then
    insert into public.task_recurrences(task_id,frequency,interval_days,weekdays,next_occurrence_at,recurrence_timezone)
    values(p_id,v_frequency,(p_input->'recurrence'->>'intervalDays')::integer,nullif(days,array[]::integer[]),nullif(p_input->>'nextOccurrenceAt','')::timestamptz,nullif(btrim(p_input->>'recurrenceTimezone'),''));
  end if;
  return p_id;
end $$;
revoke all on function public.mobile_update_task(uuid,jsonb) from public, anon;
grant execute on function public.mobile_update_task(uuid,jsonb) to authenticated;

create or replace function public.mobile_complete_task(p_task_id uuid)
returns uuid language plpgsql security definer set search_path = pg_catalog, public, pg_temp set timezone = 'UTC' as $$
declare
  task public.tasks%rowtype;
  recurrence public.task_recurrences%rowtype;
  successor uuid;
  next_due timestamptz;
  after_next timestamptz;
  reminder public.reminders%rowtype;
  reset_checklist jsonb;
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
  select coalesce(jsonb_agg(jsonb_set(elem, '{done}', 'false'::jsonb)), '[]'::jsonb)
    into reset_checklist
    from jsonb_array_elements(coalesce(task.cleaning_checklist, '[]'::jsonb)) elem;
  insert into public.tasks(title,description,creator_id,owner_id,household_id,visibility,status,priority,due_at,task_kind,cleaning_zone,cleaning_checklist)
  values(task.title,task.description,task.creator_id,task.owner_id,task.household_id,task.visibility,'PENDING',task.priority,next_due,task.task_kind,task.cleaning_zone,reset_checklist)
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
  if task.due_at is not null then
    for reminder in
      select r.* from public.reminders r
      where r.target_type = 'TASK' and r.target_id = task.id and r.status <> 'CANCELED'
        and r.remind_at <= task.due_at and r.remind_at >= task.due_at - interval '30 days'
        and ((task.visibility = 'PRIVATE' and task.owner_id = r.user_id)
          or (task.visibility = 'HOUSEHOLD_SHARED' and exists (
              select 1 from public.household_members m where m.household_id = task.household_id
                and m.user_id = r.user_id and m.left_at is null)))
      for update of r
    loop
      insert into public.reminders(target_type, target_id, user_id, household_id, remind_at, status)
      values ('TASK', successor, reminder.user_id, task.household_id, next_due - (task.due_at - reminder.remind_at), 'PENDING');
    end loop;
  end if;
  return successor;
end $$;
revoke all on function public.mobile_complete_task(uuid) from public, anon;
grant execute on function public.mobile_complete_task(uuid) to authenticated;

create or replace function public.mobile_carry_over_task(
  p_task_id uuid, p_new_due_at timestamptz, p_expected_updated_at timestamptz
) returns uuid language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  task public.tasks%rowtype;
  rec public.task_recurrences%rowtype;
begin
  if auth.uid() is null or p_new_due_at is null or p_expected_updated_at is null then
    raise exception 'INVALID_INPUT';
  end if;
  if not public.current_user_can_manage_task(p_task_id) then
    raise exception 'TASK_NOT_FOUND_OR_FORBIDDEN';
  end if;
  select * into task from public.tasks where id = p_task_id and archived_at is null for update;
  if task.id is null or task.status in ('COMPLETED', 'ARCHIVED') then
    raise exception 'TASK_NOT_ACTIVE';
  end if;
  if task.updated_at is distinct from p_expected_updated_at then
    raise exception 'STALE_TASK';
  end if;
  update public.tasks set due_at = p_new_due_at, status = 'PENDING' where id = p_task_id;
  select * into rec from public.task_recurrences where task_id = p_task_id for update;
  if rec.id is not null and rec.frequency <> 'NONE' then
    update public.task_recurrences
    set next_occurrence_at = public.next_zoned_recurrence(p_new_due_at, rec.frequency, rec.interval_days, rec.weekdays, rec.recurrence_timezone)
    where id = rec.id;
  end if;
  if task.due_at is not null then
    update public.reminders
    set remind_at = greatest(now() + interval '1 minute', p_new_due_at - greatest(task.due_at - remind_at, interval '0 minutes')),
        status = 'PENDING',
        snoozed_until = null
    where target_type = 'TASK' and target_id = p_task_id
      and user_id = auth.uid()
      and status in ('PENDING', 'SNOOZED') and delivered_at is null;
  end if;
  return p_task_id;
end $$;
revoke all on function public.mobile_carry_over_task(uuid,timestamptz,timestamptz) from public, anon;
grant execute on function public.mobile_carry_over_task(uuid,timestamptz,timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Document expiry, categories & renewal history (Part 5)
-- ---------------------------------------------------------------------------
alter table public.documents drop constraint if exists documents_category_check;
alter table public.documents add constraint documents_category_check check (
  category in ('IDENTITY', 'INSURANCE', 'CONTRACT', 'WARRANTY', 'VEHICLE', 'FINANCE', 'HOME', 'TRAVEL', 'OTHER')
);

alter table public.documents
  add column if not exists issued_at date,
  add column if not exists expires_at date,
  add column if not exists issuer text,
  add column if not exists reference_code text,
  add column if not exists renewal_required boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.documents'::regclass and conname = 'documents_expiry_fields_check') then
    alter table public.documents add constraint documents_expiry_fields_check check (
      (issuer is null or char_length(issuer) <= 180)
      and (reference_code is null or char_length(reference_code) <= 120)
      and (issued_at is null or expires_at is null or expires_at >= issued_at)
    );
  end if;
end $$;

create index if not exists documents_expires_at_idx on public.documents (expires_at) where expires_at is not null;

create table if not exists public.document_renewals (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  renewed_by uuid not null references auth.users(id) on delete restrict,
  previous_expires_at date,
  new_expires_at date not null,
  renewed_at date not null default current_date,
  note text check (note is null or char_length(note) <= 500),
  replacement_document_id uuid references public.documents(id) on delete set null,
  request_id uuid,
  created_at timestamptz not null default now(),
  constraint document_renewals_no_self_replace check (replacement_document_id is null or replacement_document_id <> document_id)
);

create index if not exists document_renewals_document_idx on public.document_renewals (document_id, created_at desc);
create index if not exists document_renewals_renewed_by_idx on public.document_renewals (renewed_by);
create index if not exists document_renewals_replacement_idx on public.document_renewals (replacement_document_id);
create unique index if not exists document_renewals_request_uniq
  on public.document_renewals (renewed_by, request_id)
  where request_id is not null;

alter table public.document_renewals enable row level security;
revoke all on table public.document_renewals from public, anon;
grant select, insert on table public.document_renewals to authenticated;

drop policy if exists "document_renewals_select_access" on public.document_renewals;
create policy "document_renewals_select_access"
on public.document_renewals for select to authenticated
using (
  exists (
    select 1 from public.documents d
    where d.id = document_renewals.document_id
      and (
        (d.visibility = 'PRIVATE' and d.created_by = (select auth.uid()))
        or (d.visibility = 'HOUSEHOLD_SHARED' and public.is_household_member(d.household_id))
      )
  )
);

drop policy if exists "document_renewals_insert_access" on public.document_renewals;
create policy "document_renewals_insert_access"
on public.document_renewals for insert to authenticated
with check (
  renewed_by = (select auth.uid())
  and exists (
    select 1 from public.documents d
    where d.id = document_renewals.document_id
      and (
        (d.visibility = 'PRIVATE' and d.created_by = (select auth.uid()))
        or (d.visibility = 'HOUSEHOLD_SHARED' and public.is_household_member(d.household_id))
      )
  )
  and (
    replacement_document_id is null
    or exists (
      select 1 from public.documents r
      where r.id = document_renewals.replacement_document_id
        and (
          (r.visibility = 'PRIVATE' and r.created_by = (select auth.uid()))
          or (r.visibility = 'HOUSEHOLD_SHARED' and public.is_household_member(r.household_id))
        )
    )
  )
);

create or replace function public.renew_document(
  p_document_id uuid,
  p_new_expires_at date,
  p_note text default null,
  p_replacement_document_id uuid default null,
  p_request_id uuid default null
) returns uuid language plpgsql security invoker set search_path = pg_catalog, public, pg_temp as $$
declare
  uid uuid := auth.uid();
  doc public.documents%rowtype;
  renewal_id uuid;
begin
  if uid is null or p_document_id is null or p_new_expires_at is null then
    raise exception 'INVALID_RENEWAL';
  end if;
  perform set_config('app.reminder_schema_version', '2', true);
  if p_request_id is not null then
    select id into renewal_id from public.document_renewals
      where renewed_by = uid and request_id = p_request_id;
    if renewal_id is not null then return renewal_id; end if;
  end if;
  select * into doc from public.documents where id = p_document_id for update;
  if doc.id is null then raise exception 'DOCUMENT_NOT_FOUND_OR_FORBIDDEN'; end if;
  if doc.issued_at is not null and p_new_expires_at < doc.issued_at then
    raise exception 'INVALID_EXPIRY_ORDER';
  end if;
  insert into public.document_renewals(document_id, renewed_by, previous_expires_at, new_expires_at, note, replacement_document_id, request_id)
  values (doc.id, uid, doc.expires_at, p_new_expires_at, nullif(btrim(p_note), ''), p_replacement_document_id, p_request_id)
  returning id into renewal_id;
  update public.documents set expires_at = p_new_expires_at, renewal_required = false where id = doc.id;
  update public.reminders
  set status = 'CANCELED', snoozed_until = null
  where target_type = 'DOCUMENT' and target_id = doc.id and user_id = uid
    and status in ('PENDING', 'SNOOZED') and delivered_at is null;
  return renewal_id;
end $$;
revoke all on function public.renew_document(uuid,date,text,uuid,uuid) from public, anon;
grant execute on function public.renew_document(uuid,date,text,uuid,uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Home appliances & maintenance logs (Part 6)
-- ---------------------------------------------------------------------------
create table if not exists public.home_appliances (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  visibility public.document_visibility not null default 'HOUSEHOLD_SHARED',
  name text not null check (char_length(btrim(name)) between 2 and 180),
  appliance_group text not null default 'APPLIANCE' check (appliance_group in ('APPLIANCE', 'SYSTEM', 'VEHICLE', 'OTHER')),
  brand text check (brand is null or char_length(brand) <= 120),
  model text check (model is null or char_length(model) <= 120),
  serial_number text check (serial_number is null or char_length(serial_number) <= 120),
  purchased_on date,
  warranty_until date,
  last_service_on date,
  next_service_at timestamptz,
  service_interval_days integer check (service_interval_days is null or service_interval_days between 1 and 3650),
  recurrence_timezone text not null default 'Asia/Tehran',
  assignee_id uuid references auth.users(id) on delete set null,
  notes text check (notes is null or char_length(notes) <= 1000),
  service_revision integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint home_appliances_visibility_household_check check (
    (visibility = 'PRIVATE' and household_id is null)
    or (visibility = 'HOUSEHOLD_SHARED' and household_id is not null)
  ),
  constraint home_appliances_dates_check check (
    purchased_on is null or warranty_until is null or warranty_until >= purchased_on
  )
);

create index if not exists home_appliances_household_idx on public.home_appliances (household_id, next_service_at) where archived_at is null;
create index if not exists home_appliances_owner_idx on public.home_appliances (owner_id, next_service_at) where archived_at is null;
create index if not exists home_appliances_created_by_idx on public.home_appliances (created_by);
create index if not exists home_appliances_assignee_idx on public.home_appliances (assignee_id);

drop trigger if exists home_appliances_set_updated_at on public.home_appliances;
create trigger home_appliances_set_updated_at
before update on public.home_appliances
for each row execute function public.set_current_timestamp_updated_at();

create or replace function public.validate_home_appliance_row()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.recurrence_timezone) then
    raise exception 'INVALID_RECURRENCE_TIMEZONE';
  end if;
  if new.assignee_id is not null then
    if new.visibility = 'PRIVATE' and new.assignee_id <> new.owner_id then
      raise exception 'INVALID_APPLIANCE_ASSIGNEE';
    end if;
    if new.visibility = 'HOUSEHOLD_SHARED' and not exists (
      select 1 from public.household_members m
      where m.household_id = new.household_id and m.user_id = new.assignee_id and m.left_at is null
    ) then
      raise exception 'INVALID_APPLIANCE_ASSIGNEE';
    end if;
  end if;
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id or new.created_by is distinct from old.created_by
       or new.owner_id is distinct from old.owner_id or new.created_at is distinct from old.created_at then
      raise exception 'APPLIANCE_IDENTITY_IMMUTABLE';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.validate_home_appliance_row() from public, anon, authenticated;
drop trigger if exists home_appliances_validate on public.home_appliances;
create trigger home_appliances_validate
before insert or update on public.home_appliances
for each row execute function public.validate_home_appliance_row();

create or replace function public.current_user_can_access_appliance(p_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public, pg_temp as $$
  select exists (
    select 1 from public.home_appliances a
    where a.id = p_id
      and (
        (a.visibility = 'PRIVATE' and a.owner_id = auth.uid())
        or (a.visibility = 'HOUSEHOLD_SHARED' and public.is_household_member(a.household_id))
      )
  );
$$;
revoke all on function public.current_user_can_access_appliance(uuid) from public, anon;
grant execute on function public.current_user_can_access_appliance(uuid) to authenticated;

alter table public.home_appliances enable row level security;
revoke all on table public.home_appliances from public, anon;
grant select, insert, update, delete on table public.home_appliances to authenticated;

drop policy if exists "home_appliances_select" on public.home_appliances;
create policy "home_appliances_select" on public.home_appliances for select to authenticated
using (
  (visibility = 'PRIVATE' and owner_id = (select auth.uid()))
  or (visibility = 'HOUSEHOLD_SHARED' and public.is_household_member(household_id))
);

drop policy if exists "home_appliances_insert" on public.home_appliances;
create policy "home_appliances_insert" on public.home_appliances for insert to authenticated
with check (
  created_by = (select auth.uid())
  and owner_id = (select auth.uid())
  and (
    (visibility = 'PRIVATE' and household_id is null)
    or (visibility = 'HOUSEHOLD_SHARED' and household_id is not null and public.is_household_member(household_id))
  )
);

drop policy if exists "home_appliances_update" on public.home_appliances;
create policy "home_appliances_update" on public.home_appliances for update to authenticated
using (
  (visibility = 'PRIVATE' and owner_id = (select auth.uid()))
  or (visibility = 'HOUSEHOLD_SHARED' and public.is_household_member(household_id))
)
with check (
  (visibility = 'PRIVATE' and owner_id = (select auth.uid()) and household_id is null)
  or (visibility = 'HOUSEHOLD_SHARED' and household_id is not null and public.is_household_member(household_id))
);

drop policy if exists "home_appliances_delete" on public.home_appliances;
create policy "home_appliances_delete" on public.home_appliances for delete to authenticated
using (
  (visibility = 'PRIVATE' and owner_id = (select auth.uid()))
  or (visibility = 'HOUSEHOLD_SHARED' and public.is_household_member(household_id))
);

create table if not exists public.appliance_maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  appliance_id uuid not null references public.home_appliances(id) on delete cascade,
  performed_by uuid not null references auth.users(id) on delete restrict,
  kind text not null default 'SERVICE' check (kind in ('SERVICE', 'REPAIR', 'INSPECTION')),
  title text not null check (char_length(btrim(title)) between 2 and 180),
  performed_on date not null default current_date,
  cost_amount bigint check (cost_amount is null or cost_amount >= 0),
  technician_name text check (technician_name is null or char_length(technician_name) <= 140),
  technician_contact text check (technician_contact is null or char_length(technician_contact) <= 140),
  financial_record_id uuid references public.financial_records(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  notes text check (notes is null or char_length(notes) <= 1000),
  next_service_at timestamptz,
  request_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists appliance_maintenance_logs_appliance_idx on public.appliance_maintenance_logs (appliance_id, performed_on desc, created_at desc);
create index if not exists appliance_maintenance_logs_performed_by_idx on public.appliance_maintenance_logs (performed_by);
create index if not exists appliance_maintenance_logs_financial_idx on public.appliance_maintenance_logs (financial_record_id);
create index if not exists appliance_maintenance_logs_document_idx on public.appliance_maintenance_logs (document_id);
create unique index if not exists appliance_maintenance_logs_request_uniq
  on public.appliance_maintenance_logs (performed_by, request_id)
  where request_id is not null;

alter table public.appliance_maintenance_logs enable row level security;
revoke all on table public.appliance_maintenance_logs from public, anon;
grant select, insert, delete on table public.appliance_maintenance_logs to authenticated;

drop policy if exists "appliance_logs_select" on public.appliance_maintenance_logs;
create policy "appliance_logs_select" on public.appliance_maintenance_logs for select to authenticated
using (public.current_user_can_access_appliance(appliance_id));

drop policy if exists "appliance_logs_insert" on public.appliance_maintenance_logs;
create policy "appliance_logs_insert" on public.appliance_maintenance_logs for insert to authenticated
with check (
  performed_by = (select auth.uid())
  and public.current_user_can_access_appliance(appliance_id)
);

drop policy if exists "appliance_logs_delete" on public.appliance_maintenance_logs;
create policy "appliance_logs_delete" on public.appliance_maintenance_logs for delete to authenticated
using (
  performed_by = (select auth.uid())
  and public.current_user_can_access_appliance(appliance_id)
);

-- Extend document entity access to APPLIANCE and reject cross-household links.
create or replace function public.current_user_can_access_document_entity(
  p_type public.document_entity_type,
  p_id uuid
) returns boolean language sql stable security definer set search_path = pg_catalog, public, pg_temp as $$
  select case p_type
    when 'TASK' then exists (
      select 1 from public.tasks t
      where t.id = p_id
        and ((t.visibility = 'PRIVATE' and t.owner_id = auth.uid())
          or (t.visibility = 'HOUSEHOLD_SHARED' and public.is_household_member(t.household_id)))
    )
    when 'EVENT' then exists (
      select 1 from public.events e
      where e.id = p_id
        and ((e.visibility = 'PRIVATE' and e.owner_id = auth.uid())
          or (e.visibility = 'HOUSEHOLD_SHARED' and public.is_household_member(e.household_id)))
    )
    when 'CHORE' then exists (
      select 1 from public.chores c where c.id = p_id and public.is_household_member(c.household_id)
    )
    when 'SHOPPING_LIST' then exists (
      select 1 from public.shopping_lists l where l.id = p_id and public.is_household_member(l.household_id)
    )
    when 'FINANCE_RECORD' then exists (
      select 1 from public.financial_records r
      where r.id = p_id
        and ((r.visibility = 'PRIVATE' and r.owner_id = auth.uid())
          or (r.visibility = 'HOUSEHOLD_SHARED' and public.is_household_member(r.household_id)))
    )
    when 'APPLIANCE' then public.current_user_can_access_appliance(p_id)
    else false
  end;
$$;
revoke all on function public.current_user_can_access_document_entity(public.document_entity_type, uuid) from public, anon;
grant execute on function public.current_user_can_access_document_entity(public.document_entity_type, uuid) to authenticated;

create or replace function public.document_entity_household_compatible(
  p_doc_household uuid,
  p_type public.document_entity_type,
  p_id uuid
) returns boolean language sql stable security definer set search_path = pg_catalog, public, pg_temp as $$
  select case
    when auth.uid() is null then false
    when p_doc_household is not null and not public.is_household_member(p_doc_household) then false
    when not public.current_user_can_access_document_entity(p_type, p_id) then false
    when p_doc_household is null then true
    when p_type = 'TASK' then exists (select 1 from public.tasks t where t.id = p_id and (t.household_id is null or t.household_id = p_doc_household))
    when p_type = 'EVENT' then exists (select 1 from public.events e where e.id = p_id and (e.household_id is null or e.household_id = p_doc_household))
    when p_type = 'CHORE' then exists (select 1 from public.chores c where c.id = p_id and c.household_id = p_doc_household)
    when p_type = 'SHOPPING_LIST' then exists (select 1 from public.shopping_lists l where l.id = p_id and l.household_id = p_doc_household)
    when p_type = 'FINANCE_RECORD' then exists (select 1 from public.financial_records r where r.id = p_id and (r.household_id is null or r.household_id = p_doc_household))
    when p_type = 'APPLIANCE' then exists (select 1 from public.home_appliances a where a.id = p_id and (a.household_id is null or a.household_id = p_doc_household))
    else false
  end;
$$;
revoke all on function public.document_entity_household_compatible(uuid, public.document_entity_type, uuid) from public, anon;
grant execute on function public.document_entity_household_compatible(uuid, public.document_entity_type, uuid) to authenticated;

drop policy if exists "document_attachments_insert_create" on public.document_attachments;
create policy "document_attachments_insert_create"
on public.document_attachments for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.documents d
    where d.id = document_attachments.document_id
      and (
        (d.visibility = 'PRIVATE' and d.created_by = (select auth.uid()))
        or (d.visibility = 'HOUSEHOLD_SHARED' and public.is_household_member(d.household_id))
      )
      and public.document_entity_household_compatible(
        d.household_id,
        document_attachments.entity_type,
        document_attachments.entity_id
      )
  )
  and public.current_user_can_access_document_entity(
    document_attachments.entity_type,
    document_attachments.entity_id
  )
);

-- Atomic maintenance completion: logs service/repair, optionally records/links
-- finance and attaches document, computes next service, and rotates reminders.
create or replace function public.record_appliance_maintenance(p_input jsonb)
returns uuid language plpgsql security invoker set search_path = pg_catalog, public, pg_temp as $$
declare
  uid uuid := auth.uid();
  app public.home_appliances%rowtype;
  v_req uuid;
  v_log uuid;
  v_kind text;
  v_title text;
  v_date date;
  v_cost bigint;
  v_doc uuid;
  v_fin uuid;
  v_create_expense boolean;
  v_next timestamptz;
  v_offsets integer[];
  v_off integer;
begin
  if uid is null or jsonb_typeof(p_input) is distinct from 'object' then
    raise exception 'INVALID_MAINTENANCE_INPUT';
  end if;
  perform set_config('app.reminder_schema_version', '2', true);
  v_req := nullif(btrim(p_input->>'requestId'), '')::uuid;
  if v_req is not null then
    select id into v_log from public.appliance_maintenance_logs
      where performed_by = uid and request_id = v_req;
    if v_log is not null then return v_log; end if;
  end if;
  select * into app from public.home_appliances
    where id = (p_input->>'applianceId')::uuid and archived_at is null
    for update;
  if app.id is null then raise exception 'APPLIANCE_NOT_FOUND_OR_FORBIDDEN'; end if;
  v_kind := coalesce(nullif(btrim(p_input->>'kind'), ''), 'SERVICE');
  v_title := btrim(coalesce(p_input->>'title', ''));
  if v_kind not in ('SERVICE', 'REPAIR', 'INSPECTION') or char_length(v_title) not between 2 and 180 then
    raise exception 'INVALID_MAINTENANCE_INPUT';
  end if;
  v_date := coalesce(nullif(btrim(p_input->>'performedOn'), '')::date, current_date);
  v_cost := nullif(btrim(p_input->>'costAmount'), '')::bigint;
  v_doc := nullif(btrim(p_input->>'documentId'), '')::uuid;
  v_fin := nullif(btrim(p_input->>'financialRecordId'), '')::uuid;
  v_create_expense := coalesce((p_input->>'recordInFinance')::boolean, false);
  if v_doc is not null then
    if not exists (select 1 from public.documents d where d.id = v_doc and (d.household_id is null or app.household_id is null or d.household_id = app.household_id)) then
      raise exception 'DOCUMENT_NOT_FOUND_OR_FORBIDDEN';
    end if;
    insert into public.document_attachments(document_id, entity_type, entity_id, created_by)
    values (v_doc, 'APPLIANCE', app.id, uid)
    on conflict (document_id, entity_type, entity_id) do nothing;
  end if;
  if v_fin is not null then
    if not exists (select 1 from public.financial_records f where f.id = v_fin and f.archived_at is null and (f.household_id is null or app.household_id is null or f.household_id = app.household_id)) then
      raise exception 'FINANCE_NOT_FOUND_OR_FORBIDDEN';
    end if;
  elsif v_create_expense and v_cost is not null and v_cost > 0 then
    insert into public.financial_records(household_id, owner_id, created_by, visibility, record_type, title, amount, currency, category, note, occurred_at)
    values (
      app.household_id,
      uid,
      uid,
      case when app.visibility = 'HOUSEHOLD_SHARED' then 'HOUSEHOLD_SHARED'::public.visibility_type else 'PRIVATE'::public.visibility_type end,
      'EXPENSE',
      app.name || ' — ' || v_title,
      v_cost,
      'IRR',
      'تعمیرات و نگهداری',
      nullif(btrim(p_input->>'notes'), ''),
      (v_date::timestamp at time zone app.recurrence_timezone)
    )
    returning id into v_fin;
  end if;
  if nullif(btrim(p_input->>'nextServiceAt'), '') is not null then
    v_next := (p_input->>'nextServiceAt')::timestamptz;
  elsif app.service_interval_days is not null then
    v_next := ((v_date + app.service_interval_days)::timestamp + time '09:00') at time zone app.recurrence_timezone;
  else
    v_next := null;
  end if;
  insert into public.appliance_maintenance_logs(
    appliance_id, performed_by, kind, title, performed_on, cost_amount,
    technician_name, technician_contact, financial_record_id, document_id,
    notes, next_service_at, request_id
  ) values (
    app.id, uid, v_kind, v_title, v_date, v_cost,
    nullif(btrim(p_input->>'technicianName'), ''),
    nullif(btrim(p_input->>'technicianContact'), ''),
    v_fin, v_doc,
    nullif(btrim(p_input->>'notes'), ''),
    v_next, v_req
  ) returning id into v_log;
  update public.home_appliances
  set last_service_on = greatest(coalesce(last_service_on, v_date), v_date),
      next_service_at = coalesce(v_next, next_service_at),
      service_revision = service_revision + 1
  where id = app.id;
  update public.reminders
  set status = 'CANCELED', snoozed_until = null
  where target_type = 'APPLIANCE' and target_id = app.id and user_id = uid
    and status in ('PENDING', 'SNOOZED') and delivered_at is null;
  if v_next is not null and jsonb_typeof(p_input->'reminderOffsetsMinutes') = 'array' then
    select coalesce(array_agg(distinct val::integer), array[]::integer[]) into v_offsets
      from jsonb_array_elements_text(p_input->'reminderOffsetsMinutes') val;
    foreach v_off in array v_offsets loop
      if v_off between 0 and 43200 and (v_next - make_interval(mins => v_off)) > now() then
        insert into public.reminders(target_type, target_id, user_id, household_id, remind_at, status)
        values ('APPLIANCE', app.id, uid, app.household_id, v_next - make_interval(mins => v_off), 'PENDING');
      end if;
    end loop;
  end if;
  return v_log;
end $$;
revoke all on function public.record_appliance_maintenance(jsonb) from public, anon;
grant execute on function public.record_appliance_maintenance(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Central reminder target authorization & v2 client compatibility (Part 7)
-- ---------------------------------------------------------------------------
create or replace function public.current_user_can_create_reminder(
  p_target_type public.reminder_target_type, p_target_id uuid, p_household_id uuid
) returns boolean language plpgsql stable security definer set search_path = pg_catalog, public, pg_temp as $$
begin
  if auth.uid() is null then return false; end if;
  if p_target_type = 'TASK' then
    return exists(select 1 from public.tasks t where t.id = p_target_id and t.archived_at is null and t.household_id is not distinct from p_household_id and public.current_user_can_access_task(t.id));
  end if;
  if p_target_type = 'EVENT' then
    return exists(select 1 from public.events e where e.id = p_target_id and e.household_id is not distinct from p_household_id and public.current_user_can_access_event(e.id));
  end if;
  if p_target_type = 'CHORE' then
    return exists(select 1 from public.chores c where c.id = p_target_id and c.archived_at is null and c.household_id is not distinct from p_household_id and public.is_household_member(c.household_id));
  end if;
  if p_target_type = 'BILL' then
    return exists(select 1 from public.financial_records r where r.id = p_target_id and r.archived_at is null and r.record_type in ('BILL','SUBSCRIPTION','INSTALLMENT') and r.household_id is not distinct from p_household_id and ((r.visibility = 'PRIVATE' and r.owner_id = auth.uid()) or (r.visibility = 'HOUSEHOLD_SHARED' and public.is_household_member(r.household_id))));
  end if;
  if p_target_type = 'DOCUMENT' then
    return exists(select 1 from public.documents d where d.id = p_target_id and d.household_id is not distinct from p_household_id and ((d.visibility = 'PRIVATE' and d.created_by = auth.uid()) or (d.visibility = 'HOUSEHOLD_SHARED' and public.is_household_member(d.household_id))));
  end if;
  if p_target_type = 'APPLIANCE' then
    return exists(select 1 from public.home_appliances a where a.id = p_target_id and a.archived_at is null and a.household_id is not distinct from p_household_id and ((a.visibility = 'PRIVATE' and a.owner_id = auth.uid()) or (a.visibility = 'HOUSEHOLD_SHARED' and public.is_household_member(a.household_id))));
  end if;
  if p_target_type = 'MEAL' then
    return exists(select 1 from public.meal_plans m where m.id = p_target_id and m.household_id is not distinct from p_household_id and public.is_household_member(m.household_id));
  end if;
  return false;
end $$;
revoke all on function public.current_user_can_create_reminder(public.reminder_target_type,uuid,uuid) from public, anon;
grant execute on function public.current_user_can_create_reminder(public.reminder_target_type,uuid,uuid) to authenticated;

create or replace function backup_private.reminder_target_authorized(
  p_user uuid, p_type public.reminder_target_type, p_target uuid, p_house uuid
) returns boolean language sql stable security definer set search_path = pg_catalog, public, backup_private, pg_temp as $$
  select case p_type
    when 'TASK' then exists(select 1 from public.tasks t where t.id = p_target and t.archived_at is null and t.household_id is not distinct from p_house and ((t.visibility = 'PRIVATE' and t.owner_id = p_user) or (t.visibility = 'HOUSEHOLD_SHARED' and exists(select 1 from public.household_members m where m.household_id = t.household_id and m.user_id = p_user and m.left_at is null))))
    when 'EVENT' then exists(select 1 from public.events e where e.id = p_target and e.household_id is not distinct from p_house and ((e.visibility = 'PRIVATE' and e.owner_id = p_user) or (e.visibility = 'HOUSEHOLD_SHARED' and exists(select 1 from public.household_members m where m.household_id = e.household_id and m.user_id = p_user and m.left_at is null))))
    when 'CHORE' then exists(select 1 from public.chores c where c.id = p_target and c.household_id is not distinct from p_house and c.archived_at is null and exists(select 1 from public.household_members m where m.household_id = c.household_id and m.user_id = p_user and m.left_at is null))
    when 'BILL' then exists(select 1 from public.financial_records f where f.id = p_target and f.household_id is not distinct from p_house and f.archived_at is null and f.record_type in ('BILL','SUBSCRIPTION','INSTALLMENT') and ((f.visibility = 'PRIVATE' and f.owner_id = p_user) or (f.visibility = 'HOUSEHOLD_SHARED' and exists(select 1 from public.household_members m where m.household_id = f.household_id and m.user_id = p_user and m.left_at is null))))
    when 'DOCUMENT' then exists(select 1 from public.documents d where d.id = p_target and d.household_id is not distinct from p_house and ((d.visibility = 'PRIVATE' and d.created_by = p_user) or (d.visibility = 'HOUSEHOLD_SHARED' and exists(select 1 from public.household_members m where m.household_id = d.household_id and m.user_id = p_user and m.left_at is null))))
    when 'APPLIANCE' then exists(select 1 from public.home_appliances a where a.id = p_target and a.archived_at is null and a.household_id is not distinct from p_house and ((a.visibility = 'PRIVATE' and a.owner_id = p_user) or (a.visibility = 'HOUSEHOLD_SHARED' and exists(select 1 from public.household_members m where m.household_id = a.household_id and m.user_id = p_user and m.left_at is null))))
    when 'MEAL' then exists(select 1 from public.meal_plans mp where mp.id = p_target and mp.household_id is not distinct from p_house and exists(select 1 from public.household_members m where m.household_id = mp.household_id and m.user_id = p_user and m.left_at is null))
    else false
  end;
$$;
revoke all on function backup_private.reminder_target_authorized(uuid,public.reminder_target_type,uuid,uuid) from public, anon, authenticated, service_role;

-- Keep legacy direct SELECT limited to original 4 target types so installed v1
-- APKs never encounter an unknown target_type in resolveTargetTitle().
drop policy if exists "reminders_select_own" on public.reminders;
create policy "reminders_select_own"
on public.reminders for select to authenticated
using (
  user_id = (select auth.uid())
  and (
    target_type in ('TASK', 'EVENT', 'CHORE', 'BILL')
    or current_setting('app.reminder_schema_version', true) = '2'
  )
);

create or replace function public.mobile_list_reminders_v2()
returns jsonb language plpgsql stable security invoker set search_path = pg_catalog, public, pg_temp as $$
declare result jsonb; n bigint;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform set_config('app.reminder_schema_version', '2', true);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.remind_at desc, x.id desc), '[]'::jsonb), count(*)
    into result, n
    from (select * from public.reminders order by remind_at desc, id desc limit 10001) x;
  if n > 10000 then raise exception 'TOO_MANY_REMINDERS'; end if;
  return result;
end $$;
revoke all on function public.mobile_list_reminders_v2() from public, anon;
grant execute on function public.mobile_list_reminders_v2() to authenticated;

create or replace function public.mobile_create_reminders_v2(
  p_rows jsonb
) returns jsonb language plpgsql security invoker set search_path = pg_catalog, public, pg_temp as $$
declare
  uid uuid := auth.uid();
  item jsonb;
  row_id uuid;
  v_type public.reminder_target_type;
  v_target uuid;
  v_house uuid;
  v_at timestamptz;
  out_rows jsonb := '[]'::jsonb;
  rec public.reminders%rowtype;
begin
  if uid is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 10 then
    raise exception 'INVALID_REMINDER_BATCH';
  end if;
  perform set_config('app.reminder_schema_version', '2', true);
  for item in select value from jsonb_array_elements(p_rows) loop
    row_id := coalesce(nullif(btrim(item->>'id'), '')::uuid, gen_random_uuid());
    v_type := (item->>'target_type')::public.reminder_target_type;
    v_target := (item->>'target_id')::uuid;
    v_house := nullif(btrim(item->>'household_id'), '')::uuid;
    v_at := (item->>'remind_at')::timestamptz;
    -- Deduplicate identical active reminder for same user, target and timestamp.
    select * into rec from public.reminders r
      where r.user_id = uid and r.target_type = v_type and r.target_id = v_target
        and r.remind_at = v_at and r.status in ('PENDING', 'SNOOZED')
      limit 1;
    if rec.id is null then
      insert into public.reminders(id, target_type, target_id, user_id, household_id, remind_at, status)
      values (row_id, v_type, v_target, uid, v_house, v_at, 'PENDING')
      on conflict (id) do nothing;
      select * into rec from public.reminders where id = row_id and user_id = uid;
    end if;
    if rec.id is null then raise exception 'REMINDER_CREATE_FAILED'; end if;
    out_rows := out_rows || jsonb_build_array(to_jsonb(rec));
  end loop;
  return out_rows;
end $$;
revoke all on function public.mobile_create_reminders_v2(jsonb) from public, anon;
grant execute on function public.mobile_create_reminders_v2(jsonb) to authenticated;

create or replace function public.mobile_mutate_reminder_v2(
  p_id uuid, p_action text, p_until timestamptz default null
) returns jsonb language plpgsql security invoker set search_path = pg_catalog, public, pg_temp as $$
declare
  rec public.reminders%rowtype;
begin
  if auth.uid() is null or p_id is null then raise exception 'INVALID_REMINDER_ACTION'; end if;
  perform set_config('app.reminder_schema_version', '2', true);
  select * into rec from public.reminders where id = p_id for update;
  if rec.id is null then raise exception 'REMINDER_NOT_FOUND'; end if;
  if p_action = 'CANCEL' then
    if rec.status not in ('PENDING', 'SNOOZED') then raise exception 'REMINDER_NOT_ACTIVE'; end if;
    update public.reminders set status = 'CANCELED', snoozed_until = null where id = p_id returning * into rec;
  elsif p_action = 'SNOOZE' then
    if p_until is null or p_until <= now() or rec.status not in ('PENDING', 'SNOOZED') then
      raise exception 'INVALID_SNOOZE';
    end if;
    update public.reminders set status = 'SNOOZED', snoozed_until = p_until, snooze_count = snooze_count + 1 where id = p_id returning * into rec;
  elsif p_action = 'RESCHEDULE' then
    if p_until is null or p_until <= now() or rec.status not in ('PENDING', 'SNOOZED') then
      raise exception 'INVALID_RESCHEDULE';
    end if;
    update public.reminders set status = 'PENDING', remind_at = p_until, snoozed_until = null where id = p_id returning * into rec;
  elsif p_action = 'REMOVE' then
    delete from public.reminders where id = p_id returning * into rec;
  else
    raise exception 'INVALID_REMINDER_ACTION';
  end if;
  return to_jsonb(rec);
end $$;
revoke all on function public.mobile_mutate_reminder_v2(uuid,text,timestamptz) from public, anon;
grant execute on function public.mobile_mutate_reminder_v2(uuid,text,timestamptz) to authenticated;
