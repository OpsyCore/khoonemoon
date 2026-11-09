-- Serialize concurrent idempotent retries and deduplicated home-management
-- creations so simultaneous requests return the winning row instead of 23505.

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
    perform pg_advisory_xact_lock(
      hashtextextended('occ_task:' || uid::text || ':' || v_source_event::text || ':' || coalesce(v_source_year, 0)::text, 0)
    );
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
  existing_doc_id uuid;
begin
  if uid is null or p_document_id is null or p_new_expires_at is null then
    raise exception 'INVALID_RENEWAL';
  end if;
  perform set_config('app.reminder_schema_version', '2', true);
  if p_request_id is not null then
    perform pg_advisory_xact_lock(
      hashtextextended('doc_renew:' || uid::text || ':' || p_request_id::text, 0)
    );
    select id, document_id into renewal_id, existing_doc_id
      from public.document_renewals
      where renewed_by = uid and request_id = p_request_id;
    if renewal_id is not null then
      if existing_doc_id is distinct from p_document_id then
        raise exception 'REQUEST_ID_REUSED_WITH_DIFFERENT_TARGET';
      end if;
      return renewal_id;
    end if;
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

create or replace function public.record_appliance_maintenance(p_input jsonb)
returns uuid language plpgsql security invoker set search_path = pg_catalog, public, pg_temp as $$
declare
  uid uuid := auth.uid();
  app public.home_appliances%rowtype;
  v_app_id uuid;
  v_req uuid;
  v_log uuid;
  v_log_app uuid;
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
  v_app_id := (p_input->>'applianceId')::uuid;
  v_req := nullif(btrim(p_input->>'requestId'), '')::uuid;
  if v_req is not null then
    perform pg_advisory_xact_lock(
      hashtextextended('app_maint:' || uid::text || ':' || v_req::text, 0)
    );
    select id, appliance_id into v_log, v_log_app
      from public.appliance_maintenance_logs
      where performed_by = uid and request_id = v_req;
    if v_log is not null then
      if v_log_app is distinct from v_app_id then
        raise exception 'REQUEST_ID_REUSED_WITH_DIFFERENT_TARGET';
      end if;
      return v_log;
    end if;
  end if;
  select * into app from public.home_appliances
    where id = v_app_id and archived_at is null
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

create or replace function public.mobile_create_reminders_v2(
  p_rows jsonb
) returns jsonb language plpgsql security invoker set search_path = pg_catalog, public, pg_temp as $$
declare
  uid uuid := auth.uid();
  lock_key text;
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
  -- Lock keys in deterministic order so overlapping concurrent batches cannot deadlock.
  for lock_key in
    select distinct
      'rem_v2:' || uid::text || ':'
      || ((elem->>'target_type')::public.reminder_target_type)::text || ':'
      || ((elem->>'target_id')::uuid)::text || ':'
      || to_char(((elem->>'remind_at')::timestamptz) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')
    from jsonb_array_elements(p_rows) elem
    order by 1
  loop
    perform pg_advisory_xact_lock(hashtextextended(lock_key, 0));
  end loop;
  for item in select value from jsonb_array_elements(p_rows) loop
    row_id := coalesce(nullif(btrim(item->>'id'), '')::uuid, gen_random_uuid());
    v_type := (item->>'target_type')::public.reminder_target_type;
    v_target := (item->>'target_id')::uuid;
    v_house := nullif(btrim(item->>'household_id'), '')::uuid;
    v_at := (item->>'remind_at')::timestamptz;
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
