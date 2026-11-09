-- Versioned v3 backup & restore: preserves v1 (19-table) and v2 (20-table)
-- snapshots for older apps while signing occasions, cleaning metadata, document
-- expiry/renewals, appliances/maintenance, and v2 reminder target types.

create or replace function public.mobile_export_snapshot_v3() returns jsonb
language plpgsql volatile security invoker set search_path = pg_catalog, public, pg_temp as $$
declare
  base jsonb;
  cfg record;
  rows_json jsonb;
  n bigint;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform set_config('app.reminder_schema_version', '2', true);
  base := public.mobile_export_snapshot_v2();
  for cfg in select * from (values
    ('tasks', 'id,title,description,creator_id,owner_id,household_id,visibility,status,priority,due_at,completed_at,archived_at,task_kind,cleaning_zone,cleaning_checklist,source_event_id,source_occurrence_year,created_at,updated_at', 'id'),
    ('events', 'id,title,description,creator_id,owner_id,household_id,visibility,start_at,end_at,all_day,location,occasion_type,recurrence_calendar,jalali_month,jalali_day,gift_idea,occasion_plan,created_at,updated_at', 'id'),
    ('documents', 'id,household_id,created_by,title,description,visibility,category,mime_type,file_size,storage_path,issued_at,expires_at,issuer,reference_code,renewal_required,created_at,updated_at', 'id'),
    ('reminders', 'id,target_type,target_id,user_id,household_id,remind_at,status,snoozed_until,snooze_count,delivered_at,created_at,updated_at', 'id'),
    ('document_renewals', 'id,document_id,renewed_by,previous_expires_at,new_expires_at,renewed_at,note,replacement_document_id,request_id,created_at', 'id'),
    ('home_appliances', 'id,household_id,owner_id,created_by,visibility,name,appliance_group,brand,model,serial_number,purchased_on,warranty_until,last_service_on,next_service_at,service_interval_days,recurrence_timezone,assignee_id,notes,service_revision,archived_at,created_at,updated_at', 'id'),
    ('appliance_maintenance_logs', 'id,appliance_id,performed_by,kind,title,performed_on,cost_amount,technician_name,technician_contact,financial_record_id,document_id,notes,next_service_at,request_id,created_at', 'id')
  ) as t(table_name, columns, sort_key) loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(r)), ''[]''::jsonb), count(*) from (select %s from public.%I order by %I limit 10001) r',
      cfg.columns, cfg.table_name, cfg.sort_key
    ) into rows_json, n;
    if n > 10000 then raise exception 'EXPORT_ROW_LIMIT'; end if;
    base := jsonb_set(base, array['tables', cfg.table_name], rows_json, true);
    base := jsonb_set(base, array['counts', cfg.table_name], to_jsonb(n), true);
    if octet_length((base->'tables')::text) > 4 * 1024 * 1024 then
      raise exception 'EXPORT_SIZE_LIMIT';
    end if;
  end loop;
  return base;
end $$;
revoke all on function public.mobile_export_snapshot_v3() from public, anon;
grant execute on function public.mobile_export_snapshot_v3() to authenticated;

grant create on schema public to khoonemoon_backup_signer;
create or replace function public.mobile_signed_export_snapshot_v3() returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, public, backup_private, pg_temp as $$
declare payload jsonb;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  payload := jsonb_build_object('account_id', auth.uid(), 'snapshot', public.mobile_export_snapshot_v3());
  return jsonb_build_object(
    'payload', payload,
    'signature', backup_private.sign_payload(backup_private.canonical_json(payload)::text)
  );
end $$;
alter function public.mobile_signed_export_snapshot_v3() owner to khoonemoon_backup_signer;
revoke all on function public.mobile_signed_export_snapshot_v3() from public, anon;
grant execute on function public.mobile_signed_export_snapshot_v3() to authenticated;
revoke create on schema public from khoonemoon_backup_signer;

create or replace function public.mobile_restore_signed_home_v3(
  p_payload jsonb, p_signature text, p_source uuid default null
) returns jsonb language plpgsql security definer set search_path = pg_catalog, public, backup_private, pg_temp as $$
declare
  uid uuid := auth.uid();
  tables jsonb;
  target_house uuid;
  source_owner boolean := false;
  current_owner boolean := false;
  r jsonb;
  row_id uuid;
  row_house uuid;
  mapped_house uuid;
  existing_owner uuid;
  existing_house uuid;
  n int;
  inserted int := 0;
  skipped int := 0;
  deferred int := 0;
begin
  if uid is null or not public.mobile_verify_snapshot_signature(p_payload, p_signature) then
    raise exception 'INVALID_BACKUP_SIGNATURE';
  end if;
  if (p_payload->>'account_id')::uuid is distinct from uid then
    raise exception 'ACCOUNT_MISMATCH';
  end if;
  tables := p_payload->'snapshot'->'tables';
  if jsonb_typeof(tables) is distinct from 'object' then
    raise exception 'INVALID_V3_BACKUP';
  end if;

  if p_source is not null then
    if not exists (
      select 1 from jsonb_array_elements(coalesce(tables->'household_members', '[]'::jsonb)) m
      where m->>'household_id' = p_source::text and m->>'user_id' = uid::text and m->>'left_at' is null
    ) then
      raise exception 'SOURCE_MEMBERSHIP_REQUIRED';
    end if;
    select exists (
      select 1 from jsonb_array_elements(coalesce(tables->'household_members', '[]'::jsonb)) m
      where m->>'household_id' = p_source::text and m->>'user_id' = uid::text and m->>'role' = 'OWNER' and m->>'left_at' is null
    ) into source_owner;
    select household_id, (role = 'OWNER') into target_house, current_owner
      from public.household_members where user_id = uid and left_at is null for share;
    if target_house is not null and target_house <> p_source and not exists (
      select 1 from backup_private.recovered_households
      where account_id = uid and source_id = p_source and signature = p_signature and replacement_id = target_house
    ) then
      target_house := null;
    end if;
  end if;

  -- Hydrate extended v3 fields only on rows whose timestamps still match the signed snapshot.
  for r in select value from jsonb_array_elements(coalesce(tables->'events', '[]'::jsonb)) loop
    update public.events e
    set occasion_type = nullif(r->>'occasion_type', ''),
        recurrence_calendar = nullif(r->>'recurrence_calendar', ''),
        jalali_month = nullif(r->>'jalali_month', '')::smallint,
        jalali_day = nullif(r->>'jalali_day', '')::smallint,
        gift_idea = nullif(r->>'gift_idea', ''),
        occasion_plan = nullif(r->>'occasion_plan', ''),
        updated_at = (r->>'updated_at')::timestamptz
    where e.id = (r->>'id')::uuid
      and e.created_at = (r->>'created_at')::timestamptz
      and (e.owner_id = uid or (target_house is not null and e.household_id = target_house and source_owner and current_owner))
      and e.occasion_type is null and r->>'occasion_type' is not null;
  end loop;

  for r in select value from jsonb_array_elements(coalesce(tables->'tasks', '[]'::jsonb)) loop
    update public.tasks t
    set task_kind = coalesce(nullif(r->>'task_kind', ''), 'GENERAL'),
        cleaning_zone = nullif(r->>'cleaning_zone', ''),
        cleaning_checklist = coalesce(r->'cleaning_checklist', '[]'::jsonb),
        source_event_id = case
          when nullif(r->>'source_event_id', '') is not null
               and exists (select 1 from public.events ev where ev.id = (r->>'source_event_id')::uuid)
          then (r->>'source_event_id')::uuid else null end,
        source_occurrence_year = nullif(r->>'source_occurrence_year', '')::smallint,
        updated_at = (r->>'updated_at')::timestamptz
    where t.id = (r->>'id')::uuid
      and t.created_at = (r->>'created_at')::timestamptz
      and (t.owner_id = uid or (target_house is not null and t.household_id = target_house and source_owner and current_owner));
  end loop;

  for r in select value from jsonb_array_elements(coalesce(tables->'documents', '[]'::jsonb)) loop
    update public.documents d
    set issued_at = nullif(r->>'issued_at', '')::date,
        expires_at = nullif(r->>'expires_at', '')::date,
        issuer = nullif(r->>'issuer', ''),
        reference_code = nullif(r->>'reference_code', ''),
        renewal_required = coalesce((r->>'renewal_required')::boolean, false),
        updated_at = (r->>'updated_at')::timestamptz
    where d.id = (r->>'id')::uuid
      and d.created_at = (r->>'created_at')::timestamptz
      and (d.created_by = uid or (target_house is not null and d.household_id = target_house and source_owner and current_owner));
  end loop;

  -- Restore home_appliances
  if jsonb_array_length(coalesce(tables->'home_appliances', '[]'::jsonb)) > 10000 then
    raise exception 'INVALID_V3_BACKUP';
  end if;
  for r in select value from jsonb_array_elements(coalesce(tables->'home_appliances', '[]'::jsonb)) loop
    row_id := (r->>'id')::uuid;
    row_house := nullif(r->>'household_id', '')::uuid;
    if row_house is null then
      if r->>'owner_id' is distinct from uid::text then deferred := deferred + 1; continue; end if;
      mapped_house := null;
    else
      if p_source is null or row_house <> p_source or target_house is null then deferred := deferred + 1; continue; end if;
      if r->>'owner_id' is distinct from uid::text and not (source_owner and current_owner) then deferred := deferred + 1; continue; end if;
      mapped_house := target_house;
    end if;
    select owner_id, household_id into existing_owner, existing_house from public.home_appliances where id = row_id for share;
    if found then
      if (mapped_house is null and existing_owner is distinct from uid)
         or (mapped_house is not null and existing_house is distinct from mapped_house) then
        raise exception 'BACKUP_ID_CONFLICT';
      end if;
      skipped := skipped + 1; continue;
    end if;
    insert into public.home_appliances(
      id, household_id, owner_id, created_by, visibility, name, appliance_group,
      brand, model, serial_number, purchased_on, warranty_until, last_service_on,
      next_service_at, service_interval_days, recurrence_timezone, assignee_id,
      notes, service_revision, archived_at, created_at, updated_at
    ) select
      x.id, mapped_house, x.owner_id, x.created_by, x.visibility, x.name, x.appliance_group,
      x.brand, x.model, x.serial_number, x.purchased_on, x.warranty_until, x.last_service_on,
      x.next_service_at, x.service_interval_days, x.recurrence_timezone,
      case
        when x.assignee_id is null then null
        when mapped_house is null and x.assignee_id = x.owner_id then x.assignee_id
        when mapped_house is not null and exists (select 1 from public.household_members m where m.household_id = mapped_house and m.user_id = x.assignee_id and m.left_at is null) then x.assignee_id
        else null
      end,
      x.notes, x.service_revision, x.archived_at, x.created_at, x.updated_at
    from jsonb_populate_record(null::public.home_appliances, r) x
    on conflict (id) do nothing;
    get diagnostics n = row_count;
    if n = 1 then inserted := inserted + 1; else skipped := skipped + 1; end if;
  end loop;

  -- Restore appliance_maintenance_logs
  if jsonb_array_length(coalesce(tables->'appliance_maintenance_logs', '[]'::jsonb)) > 10000 then
    raise exception 'INVALID_V3_BACKUP';
  end if;
  for r in select value from jsonb_array_elements(coalesce(tables->'appliance_maintenance_logs', '[]'::jsonb)) loop
    row_id := (r->>'id')::uuid;
    if not exists (
      select 1 from public.home_appliances a
      where a.id = (r->>'appliance_id')::uuid
        and ((a.household_id is null and a.owner_id = uid) or (target_house is not null and a.household_id = target_house))
    ) then
      deferred := deferred + 1; continue;
    end if;
    if r->>'performed_by' is distinct from uid::text and not (source_owner and current_owner) then
      deferred := deferred + 1; continue;
    end if;
    if exists (select 1 from public.appliance_maintenance_logs where id = row_id) then
      skipped := skipped + 1; continue;
    end if;
    insert into public.appliance_maintenance_logs(
      id, appliance_id, performed_by, kind, title, performed_on, cost_amount,
      technician_name, technician_contact, financial_record_id, document_id,
      notes, next_service_at, request_id, created_at
    ) select
      x.id, x.appliance_id, x.performed_by, x.kind, x.title, x.performed_on, x.cost_amount,
      x.technician_name, x.technician_contact,
      case when x.financial_record_id is not null and exists (select 1 from public.financial_records f where f.id = x.financial_record_id) then x.financial_record_id else null end,
      case when x.document_id is not null and exists (select 1 from public.documents d where d.id = x.document_id) then x.document_id else null end,
      x.notes, x.next_service_at, x.request_id, x.created_at
    from jsonb_populate_record(null::public.appliance_maintenance_logs, r) x
    on conflict do nothing;
    get diagnostics n = row_count;
    if n = 1 then inserted := inserted + 1; else skipped := skipped + 1; end if;
  end loop;

  -- Restore document_renewals
  if jsonb_array_length(coalesce(tables->'document_renewals', '[]'::jsonb)) > 10000 then
    raise exception 'INVALID_V3_BACKUP';
  end if;
  for r in select value from jsonb_array_elements(coalesce(tables->'document_renewals', '[]'::jsonb)) loop
    row_id := (r->>'id')::uuid;
    if not exists (
      select 1 from public.documents d
      where d.id = (r->>'document_id')::uuid
        and ((d.household_id is null and d.created_by = uid) or (target_house is not null and d.household_id = target_house))
    ) then
      deferred := deferred + 1; continue;
    end if;
    if r->>'renewed_by' is distinct from uid::text and not (source_owner and current_owner) then
      deferred := deferred + 1; continue;
    end if;
    if exists (select 1 from public.document_renewals where id = row_id) then
      skipped := skipped + 1; continue;
    end if;
    insert into public.document_renewals(
      id, document_id, renewed_by, previous_expires_at, new_expires_at,
      renewed_at, note, replacement_document_id, request_id, created_at
    ) select
      x.id, x.document_id, x.renewed_by, x.previous_expires_at, x.new_expires_at,
      x.renewed_at, x.note,
      case when x.replacement_document_id is not null and exists (select 1 from public.documents d where d.id = x.replacement_document_id) then x.replacement_document_id else null end,
      x.request_id, x.created_at
    from jsonb_populate_record(null::public.document_renewals, r) x
    on conflict do nothing;
    get diagnostics n = row_count;
    if n = 1 then inserted := inserted + 1; else skipped := skipped + 1; end if;
  end loop;

  -- Restore APPLIANCE document_attachments
  for r in select value from jsonb_array_elements(coalesce(tables->'document_attachments', '[]'::jsonb))
    where value->>'entity_type' = 'APPLIANCE' loop
    if r->>'created_by' is distinct from uid::text and not (source_owner and current_owner) then
      deferred := deferred + 1; continue;
    end if;
    if not exists (select 1 from public.documents d where d.id = (r->>'document_id')::uuid)
       or not exists (select 1 from public.home_appliances a where a.id = (r->>'entity_id')::uuid) then
      deferred := deferred + 1; continue;
    end if;
    insert into public.document_attachments(id, document_id, entity_type, entity_id, created_by, created_at)
    values ((r->>'id')::uuid, (r->>'document_id')::uuid, 'APPLIANCE', (r->>'entity_id')::uuid, (r->>'created_by')::uuid, (r->>'created_at')::timestamptz)
    on conflict do nothing;
    get diagnostics n = row_count;
    if n = 1 then inserted := inserted + 1; else skipped := skipped + 1; end if;
  end loop;

  -- Restore v2 reminders (DOCUMENT, APPLIANCE, MEAL) owned by the caller
  for r in select value from jsonb_array_elements(coalesce(tables->'reminders', '[]'::jsonb))
    where (value->>'target_type') in ('DOCUMENT', 'APPLIANCE', 'MEAL') loop
    if r->>'user_id' is distinct from uid::text then deferred := deferred + 1; continue; end if;
    row_house := nullif(r->>'household_id', '')::uuid;
    mapped_house := case when row_house is null then null when p_source is not null and row_house = p_source then target_house else null end;
    if row_house is not null and mapped_house is null then deferred := deferred + 1; continue; end if;
    if not backup_private.reminder_target_authorized(uid, (r->>'target_type')::public.reminder_target_type, (r->>'target_id')::uuid, mapped_house) then
      deferred := deferred + 1; continue;
    end if;
    insert into public.reminders(
      id, target_type, target_id, user_id, household_id, remind_at,
      status, snoozed_until, snooze_count, delivered_at, created_at, updated_at
    ) select
      x.id, x.target_type, x.target_id, uid, mapped_house, x.remind_at,
      x.status, x.snoozed_until, x.snooze_count, x.delivered_at, x.created_at, x.updated_at
    from jsonb_populate_record(null::public.reminders, r) x
    on conflict (id) do nothing;
    get diagnostics n = row_count;
    if n = 1 then inserted := inserted + 1; else skipped := skipped + 1; end if;
  end loop;

  return jsonb_build_object('inserted', inserted, 'skipped', skipped, 'deferred', deferred);
end $$;
revoke all on function public.mobile_restore_signed_home_v3(jsonb,text,uuid) from public, anon;
grant execute on function public.mobile_restore_signed_home_v3(jsonb,text,uuid) to authenticated;

-- Allow shared v3 snapshots containing APPLIANCE attachments to defer APPLIANCE
-- attachment insertion until mobile_restore_signed_home_v3 restores appliances.
create or replace function public.mobile_restore_signed_shared(p_payload jsonb,p_signature text,p_source uuid,p_phase text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,backup_private,pg_temp as $$
declare uid uuid:=auth.uid(); target uuid; tabs jsonb; parents jsonb; cfg record; r jsonb; item jsonb; parent_id uuid; key_id uuid; existing_home uuid; existing_parent uuid; exists_row boolean; n int; inserted int:=0; skipped int:=0; deferred int:=0; actual_next timestamptz;
begin
 if uid is null or p_source is null or p_phase is null or p_phase not in ('parents','children') or not public.mobile_verify_snapshot_signature(p_payload,p_signature) then raise exception 'INVALID_BACKUP_SIGNATURE'; end if;
 tabs:=p_payload->'snapshot'->'tables';
 if not exists(select 1 from jsonb_array_elements(tabs->'household_members') m where m->>'household_id'=p_source::text and m->>'user_id'=uid::text and m->>'role'='OWNER' and m->>'left_at' is null) then raise exception 'BACKUP_OWNER_REQUIRED'; end if;
 select household_id into target from public.household_members where user_id=uid and role='OWNER' and left_at is null for share;
 if target is null then raise exception 'CURRENT_OWNER_REQUIRED'; end if;
 if target<>p_source and not exists(select 1 from backup_private.recovered_households where account_id=uid and source_id=p_source and signature=p_signature and replacement_id=target) then raise exception 'HOUSEHOLD_MISMATCH'; end if;
 if p_phase='parents' then
  for cfg in select * from (values
   ('shopping_lists','id,household_id,name,created_by,archived_at,created_at,updated_at',false),
   ('tasks','id,title,description,creator_id,owner_id,household_id,visibility,status,priority,due_at,completed_at,archived_at,created_at,updated_at',true),
   ('events','id,title,description,creator_id,owner_id,household_id,visibility,start_at,end_at,all_day,location,created_at,updated_at',true),
   ('chores','id,household_id,title,description,created_by,rotation_mode,current_rotation_index,frequency,interval_days,weekdays,next_due_at,recurrence_timezone,is_active,completion_revision,archived_at,created_at,updated_at',false),
   ('financial_records','id,household_id,owner_id,created_by,visibility,record_type,title,amount,currency,category,note,occurred_at,due_at,bill_status,is_recurring,recurrence_rule,recurrence_timezone,paid_by,paid_at,archived_at,created_at,updated_at',true)
  ) as c(name,columns,has_visibility) loop
   if jsonb_typeof(tabs->cfg.name) is distinct from 'array' then raise exception 'INVALID_BACKUP'; end if;
   for r in select value from jsonb_array_elements(tabs->cfg.name) loop
    if r->>'household_id' is distinct from p_source::text or (cfg.has_visibility and r->>'visibility' is distinct from 'HOUSEHOLD_SHARED') then continue; end if;
    key_id:=(r->>'id')::uuid;
    execute format('select exists(select 1 from public.%I where id=$1)',cfg.name) into exists_row using key_id;
    if exists_row then
      execute format('select household_id from public.%I where id=$1 for share',cfg.name) into existing_home using key_id;
      if existing_home is distinct from target then raise exception 'BACKUP_ID_CONFLICT'; end if;
      skipped:=skipped+1; continue;
    end if;
    item:=jsonb_set(r,'{household_id}',to_jsonb(target::text));
    execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1)',cfg.name,cfg.columns,cfg.columns,cfg.name) using item;
    get diagnostics n=row_count; if n<>1 then raise exception 'BACKUP_SHARED_FAILED'; end if;
    inserted:=inserted+1;
   end loop;
  end loop;
 else
  select jsonb_build_object(
   'tasks',coalesce((select jsonb_object_agg(v->>'id','true'::jsonb) from jsonb_array_elements(tabs->'tasks') v where v->>'household_id'=p_source::text),'{}'::jsonb),
   'chores',coalesce((select jsonb_object_agg(v->>'id','true'::jsonb) from jsonb_array_elements(tabs->'chores') v where v->>'household_id'=p_source::text),'{}'::jsonb),
   'shopping_lists',coalesce((select jsonb_object_agg(v->>'id','true'::jsonb) from jsonb_array_elements(tabs->'shopping_lists') v where v->>'household_id'=p_source::text),'{}'::jsonb),
   'documents',coalesce((select jsonb_object_agg(v->>'id','true'::jsonb) from jsonb_array_elements(tabs->'documents') v),'{}'::jsonb)
  ) into parents;
  for cfg in select * from (values
    ('task_assignees','tasks','task_id','id,task_id,assignee_id,created_at'),
    ('task_recurrences','tasks','task_id','id,task_id,frequency,interval_days,weekdays,next_occurrence_at,recurrence_timezone,created_at,updated_at'),
    ('chore_rotation_steps','chores','chore_id','id,chore_id,position,assignee_id,created_at'),
    ('shopping_items','shopping_lists','list_id','id,list_id,name,quantity,unit,category,note,added_by,purchased,purchased_by,purchased_at,position,created_at,updated_at')
   ) as c(name,parent_name,parent_key,columns) loop
   if jsonb_typeof(tabs->cfg.name) is distinct from 'array' or jsonb_typeof(tabs->cfg.parent_name) is distinct from 'array' then raise exception 'INVALID_BACKUP'; end if;
   for r in select value from jsonb_array_elements(tabs->cfg.name) loop
    parent_id:=(r->>cfg.parent_key)::uuid; key_id:=(r->>'id')::uuid;
    if not (parents->cfg.parent_name ? parent_id::text) then continue; end if;
    execute format('select household_id from public.%I where id=$1 for share',cfg.parent_name) into existing_home using parent_id;
    if existing_home is distinct from target then raise exception 'BACKUP_PARENT_NOT_ACCESSIBLE'; end if;
    execute format('select exists(select 1 from public.%I where id=$1)',cfg.name) into exists_row using key_id;
    if exists_row then
      execute format('select %I from public.%I where id=$1',cfg.parent_key,cfg.name) into existing_parent using key_id;
      if existing_parent is distinct from parent_id then raise exception 'BACKUP_ID_CONFLICT'; end if;
      skipped:=skipped+1; continue;
    end if;
    if cfg.name in ('task_assignees','chore_rotation_steps') then
     perform 1 from public.household_members where household_id=target and user_id=(r->>'assignee_id')::uuid and left_at is null for share;
     if not found then deferred:=deferred+1; continue; end if;
    end if;
    execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1)',cfg.name,cfg.columns,cfg.columns,cfg.name) using r;
    get diagnostics n=row_count; if n<>1 then raise exception 'BACKUP_SHARED_FAILED'; end if;
    if cfg.name='task_recurrences' then
     select next_occurrence_at into actual_next from public.task_recurrences where id=key_id;
     if actual_next is distinct from (r->>'next_occurrence_at')::timestamptz then raise exception 'RESTORE_RECURRENCE_MISMATCH'; end if;
    end if;
    inserted:=inserted+1;
   end loop;
  end loop;
  if jsonb_typeof(tabs->'document_attachments') is distinct from 'array' or jsonb_typeof(tabs->'documents') is distinct from 'array' then raise exception 'INVALID_BACKUP'; end if;
  for r in select value from jsonb_array_elements(tabs->'document_attachments') loop
   if r->>'entity_type' = 'APPLIANCE' then continue; end if;
   key_id:=(r->>'id')::uuid; parent_id:=(r->>'document_id')::uuid;
   if not (parents->'documents' ? parent_id::text) then raise exception 'INVALID_BACKUP'; end if;
   if exists(select 1 from public.document_attachments a where a.id=key_id) then
     if not exists(select 1 from public.document_attachments a where a.id=key_id and a.document_id=parent_id and a.entity_type=(r->>'entity_type')::public.document_entity_type and a.entity_id=(r->>'entity_id')::uuid and a.created_by=(r->>'created_by')::uuid) then raise exception 'BACKUP_ID_CONFLICT'; end if;
     skipped:=skipped+1; continue;
   end if;
   perform 1 from public.documents where id=parent_id for share;
   case r->>'entity_type'
    when 'TASK' then perform 1 from public.tasks where id=(r->>'entity_id')::uuid for share;
    when 'EVENT' then perform 1 from public.events where id=(r->>'entity_id')::uuid for share;
    when 'CHORE' then perform 1 from public.chores where id=(r->>'entity_id')::uuid for share;
    when 'SHOPPING_LIST' then perform 1 from public.shopping_lists where id=(r->>'entity_id')::uuid for share;
    when 'FINANCE_RECORD' then perform 1 from public.financial_records where id=(r->>'entity_id')::uuid for share;
    else raise exception 'INVALID_BACKUP';
   end case;
   if not exists(select 1 from public.documents d where d.id=parent_id and ((d.visibility='PRIVATE' and d.created_by=uid) or (d.visibility='HOUSEHOLD_SHARED' and d.household_id=target))) or not public.current_user_can_access_document_entity((r->>'entity_type')::public.document_entity_type,(r->>'entity_id')::uuid) then deferred:=deferred+1; continue; end if;
   insert into public.document_attachments(id,document_id,entity_type,entity_id,created_by,created_at)
    select id,document_id,entity_type,entity_id,created_by,created_at from jsonb_populate_record(null::public.document_attachments,r);
   inserted:=inserted+1;
  end loop;
 end if;
 return jsonb_build_object('inserted',inserted,'skipped',skipped,'deferred',deferred);
end $$;
revoke all on function public.mobile_restore_signed_shared(jsonb,text,uuid,text) from public,anon;
grant execute on function public.mobile_restore_signed_shared(jsonb,text,uuid,text) to authenticated;
