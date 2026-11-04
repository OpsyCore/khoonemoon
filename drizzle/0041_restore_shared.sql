-- Restore signed shared data as its original authors, without granting membership
-- to anybody or permitting clients to forge records. Storage bytes are NOT
-- signed, so documents are intentionally excluded here.
create or replace function public.mobile_restore_signed_shared(p_payload jsonb,p_signature text,p_source uuid,p_phase text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,backup_private as $$
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
  -- Build keyed parent sets once; do not rescan every parent for every child.
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
