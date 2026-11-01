-- Same-account bounded recovery; only inserts absent rows, never updates or deletes.
-- All SQL executes under the caller's existing table permissions and RLS.
-- Parent/auth/household/history rows that users cannot insert must already exist.
create or replace function public.mobile_restore_missing(p_tables jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,storage as $$
declare cfg record; row_data jsonb; exists_row boolean; key_value text; n integer; total integer:=0; inserted integer:=0; skipped integer:=0; actual_next timestamptz;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
 if p_tables is null or jsonb_typeof(p_tables)<>'object' or octet_length(p_tables::text)>4*1024*1024 then raise exception 'INVALID_RESTORE'; end if;
 if (select count(*) from jsonb_object_keys(p_tables))<>19 then raise exception 'INVALID_RESTORE_TABLES'; end if;
 for cfg in select * from (values
      ('profiles','id,full_name,timezone,locale,created_at,updated_at','id',false),
      ('households','id,name,created_by,created_at,updated_at','id',false),
      ('household_members','id,household_id,user_id,role,joined_at,left_at,created_at','id',false),
      ('shopping_lists','id,household_id,name,created_by,archived_at,created_at,updated_at','id',true),
      ('tasks','id,title,description,creator_id,owner_id,household_id,visibility,status,priority,due_at,completed_at,archived_at,created_at,updated_at','id',true),
      ('events','id,title,description,creator_id,owner_id,household_id,visibility,start_at,end_at,all_day,location,created_at,updated_at','id',true),
      ('chores','id,household_id,title,description,created_by,rotation_mode,current_rotation_index,frequency,interval_days,weekdays,next_due_at,recurrence_timezone,is_active,completion_revision,archived_at,created_at,updated_at','id',true),
      ('financial_records','id,household_id,owner_id,created_by,visibility,record_type,title,amount,currency,category,note,occurred_at,due_at,bill_status,is_recurring,recurrence_rule,recurrence_timezone,paid_by,paid_at,archived_at,created_at,updated_at','id',true),
      ('reminders','id,target_type,target_id,user_id,household_id,remind_at,status,snoozed_until,snooze_count,delivered_at,created_at,updated_at','id',true),
      ('notification_preferences','id,user_id,in_app_enabled,web_push_enabled,quiet_hours_enabled,quiet_hours_start,quiet_hours_end,created_at,updated_at','id',true),
      ('task_assignees','id,task_id,assignee_id,created_at','id',true),
      ('task_recurrences','id,task_id,frequency,interval_days,weekdays,next_occurrence_at,recurrence_timezone,created_at,updated_at','id',true),
      ('chore_rotation_steps','id,chore_id,position,assignee_id,created_at','id',true),
      ('shopping_items','id,list_id,name,quantity,unit,category,note,added_by,purchased,purchased_by,purchased_at,position,created_at,updated_at','id',true),
      ('documents','id,household_id,created_by,title,description,visibility,category,mime_type,file_size,storage_path,created_at,updated_at','id',true),
      ('document_attachments','id,document_id,entity_type,entity_id,created_by,created_at','id',true),
      ('task_recurrence_instances','completed_task_id,next_task_id,created_at','completed_task_id',false),
      ('finance_recurrence_instances','paid_record_id,next_record_id,created_at','paid_record_id',false),
      ('chore_completions','id,chore_id,completed_by,completed_at,due_at,note,created_at','id',false)
 ) as config(table_name,columns,key_name,writable) loop
   if jsonb_typeof(p_tables->cfg.table_name) is distinct from 'array' then raise exception 'INVALID_RESTORE_TABLES'; end if;
   total:=total+jsonb_array_length(p_tables->cfg.table_name);
   if total>500 then raise exception 'RESTORE_ROW_LIMIT'; end if;
   for row_data in select value from jsonb_array_elements(p_tables->cfg.table_name) loop
     if jsonb_typeof(row_data)<>'object' then raise exception 'INVALID_RESTORE_ROW'; end if;
     key_value:=row_data->>cfg.key_name;
     if key_value is null or key_value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'INVALID_RESTORE_ID'; end if;
     execute format('select exists(select 1 from public.%I where %I=$1::uuid)',cfg.table_name,cfg.key_name) into exists_row using key_value;
     if exists_row then skipped:=skipped+1; continue; end if;
     if not cfg.writable then raise exception 'RESTORE_PARENT_OR_HISTORY_MISSING'; end if;
     if cfg.table_name='documents' and (row_data->>'storage_path' is null or not exists(select 1 from storage.objects o where o.bucket_id='documents' and o.name=row_data->>'storage_path')) then raise exception 'RESTORE_DOCUMENT_FILE_MISSING'; end if;
     execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1)',cfg.table_name,cfg.columns,cfg.columns,cfg.table_name) using row_data;
     get diagnostics n=row_count; if n<>1 then raise exception 'RESTORE_INSERT_FAILED'; end if;
     -- The recurrence trigger may recompute its next occurrence. Roll back if it differs.
     if cfg.table_name='task_recurrences' then
       select next_occurrence_at into actual_next from public.task_recurrences where id=key_value::uuid;
       if actual_next is distinct from (row_data->>'next_occurrence_at')::timestamptz then raise exception 'RESTORE_RECURRENCE_MISMATCH'; end if;
     end if;
     inserted:=inserted+1;
   end loop;
 end loop;
 return jsonb_build_object('inserted',inserted,'skipped',skipped);
end $$;
revoke all on function public.mobile_restore_missing(jsonb) from public,anon;
grant execute on function public.mobile_restore_missing(jsonb) to authenticated;
