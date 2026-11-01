-- Consistent snapshot of only the caller-visible, explicitly selected application data.
-- It does not contain auth credentials, invitations, device credentials, or Storage bytes.
create or replace function public.mobile_export_snapshot()
returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare cfg record; table_rows jsonb; row_count bigint; all_tables jsonb := '{}'::jsonb; all_counts jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  for cfg in select * from (values
      ('profiles','id,full_name,timezone,locale,created_at,updated_at','id'),
      ('households','id,name,created_by,created_at,updated_at','id'),
      ('household_members','id,household_id,user_id,role,joined_at,left_at,created_at','id'),
      ('task_recurrence_instances','completed_task_id,next_task_id,created_at','completed_task_id'),
      ('finance_recurrence_instances','paid_record_id,next_record_id,created_at','paid_record_id'),
      ('tasks','id,title,description,creator_id,owner_id,household_id,visibility,status,priority,due_at,completed_at,archived_at,created_at,updated_at','id'),
      ('task_assignees','id,task_id,assignee_id,created_at','id'),
      ('task_recurrences','id,task_id,frequency,interval_days,weekdays,next_occurrence_at,recurrence_timezone,created_at,updated_at','id'),
      ('events','id,title,description,creator_id,owner_id,household_id,visibility,start_at,end_at,all_day,location,created_at,updated_at','id'),
      ('reminders','id,target_type,target_id,user_id,household_id,remind_at,status,snoozed_until,snooze_count,delivered_at,created_at,updated_at','id'),
      ('notification_preferences','id,user_id,in_app_enabled,web_push_enabled,quiet_hours_enabled,quiet_hours_start,quiet_hours_end,created_at,updated_at','id'),
      ('chores','id,household_id,title,description,created_by,rotation_mode,current_rotation_index,frequency,interval_days,weekdays,next_due_at,recurrence_timezone,is_active,completion_revision,archived_at,created_at,updated_at','id'),
      ('chore_rotation_steps','id,chore_id,position,assignee_id,created_at','id'),
      ('chore_completions','id,chore_id,completed_by,completed_at,due_at,note,created_at','id'),
      ('shopping_lists','id,household_id,name,created_by,archived_at,created_at,updated_at','id'),
      ('shopping_items','id,list_id,name,quantity,unit,category,note,added_by,purchased,purchased_by,purchased_at,position,created_at,updated_at','id'),
      ('financial_records','id,household_id,owner_id,created_by,visibility,record_type,title,amount,currency,category,note,occurred_at,due_at,bill_status,is_recurring,recurrence_rule,recurrence_timezone,paid_by,paid_at,archived_at,created_at,updated_at','id'),
      ('documents','id,household_id,created_by,title,description,visibility,category,mime_type,file_size,storage_path,created_at,updated_at','id'),
      ('document_attachments','id,document_id,entity_type,entity_id,created_by,created_at','id')
    ) as config(table_name,columns,sort_key) loop
    -- SQL identifiers and column lists above are constants, never client input.
    execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb),count(*) from (select %s from public.%I order by %I limit 10001) r',cfg.columns,cfg.table_name,cfg.sort_key) into table_rows,row_count;
    if row_count>10000 then raise exception 'EXPORT_ROW_LIMIT'; end if;
    all_tables := all_tables || jsonb_build_object(cfg.table_name,table_rows);
    all_counts := all_counts || jsonb_build_object(cfg.table_name,row_count);
    if octet_length(all_tables::text)>4*1024*1024 then raise exception 'EXPORT_SIZE_LIMIT'; end if;
  end loop;
  return jsonb_build_object('exported_at',now(),'tables',all_tables,'counts',all_counts);
end $$;
revoke all on function public.mobile_export_snapshot() from public,anon;
grant execute on function public.mobile_export_snapshot() to authenticated;
