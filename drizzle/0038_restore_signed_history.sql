-- Restore only authentic, previously exported historical links/completions.
-- This does not recreate households or memberships, change current rows, or
-- grant membership to anybody. Current access is rechecked and locked.
create or replace function public.mobile_restore_signed_history(p_payload jsonb,p_signature text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare tbl text; r jsonb; snapshot jsonb; n integer; inserted integer:=0; skipped integer:=0;
  source_id uuid; target_id uuid; key_id uuid; source_record record; target_record record;
begin
 if not public.mobile_verify_snapshot_signature(p_payload,p_signature) then raise exception 'INVALID_BACKUP_SIGNATURE'; end if;
 snapshot:=p_payload->'snapshot'->'tables';
 if jsonb_typeof(snapshot)<>'object' then raise exception 'INVALID_BACKUP'; end if;
 -- Prevent concurrent leave/removal while checking shared-parent permissions.
 perform 1 from public.household_members where user_id=auth.uid() and left_at is null for share;
 foreach tbl in array array['task_recurrence_instances','finance_recurrence_instances','chore_completions'] loop
  if jsonb_typeof(snapshot->tbl) is distinct from 'array' or jsonb_array_length(snapshot->tbl)>10000 then raise exception 'INVALID_BACKUP'; end if;
  for r in select value from jsonb_array_elements(snapshot->tbl) loop
   if tbl='chore_completions' then
    key_id:=(r->>'id')::uuid; source_id:=(r->>'chore_id')::uuid;
    perform 1 from public.chores where id=source_id for share;
    if not public.current_user_can_access_chore(source_id) then raise exception 'BACKUP_PARENT_NOT_ACCESSIBLE'; end if;
    if exists(select 1 from public.chore_completions where id=key_id) then skipped:=skipped+1; continue; end if;
    insert into public.chore_completions (id,chore_id,completed_by,completed_at,due_at,note,created_at)
    select id,chore_id,completed_by,completed_at,due_at,note,created_at from jsonb_populate_record(null::public.chore_completions,r);
   elsif tbl='task_recurrence_instances' then
    source_id:=(r->>'completed_task_id')::uuid; target_id:=(r->>'next_task_id')::uuid;
    perform 1 from public.tasks where id in (source_id,target_id) order by id for share;
    if not public.current_user_can_access_task(source_id) or not public.current_user_can_access_task(target_id) then raise exception 'BACKUP_PARENT_NOT_ACCESSIBLE'; end if;
    select status,household_id,owner_id,visibility into source_record from public.tasks where id=source_id;
    select household_id,owner_id,visibility into target_record from public.tasks where id=target_id;
    if source_record.status <> 'COMPLETED' or source_record.household_id is distinct from target_record.household_id or source_record.owner_id is distinct from target_record.owner_id or source_record.visibility is distinct from target_record.visibility then raise exception 'BACKUP_PARENT_CHANGED'; end if;
    if exists(select 1 from public.task_recurrence_instances where completed_task_id=source_id) then skipped:=skipped+1; continue; end if;
    insert into public.task_recurrence_instances (completed_task_id,next_task_id,created_at)
    select completed_task_id,next_task_id,created_at from jsonb_populate_record(null::public.task_recurrence_instances,r);
   else
    source_id:=(r->>'paid_record_id')::uuid; target_id:=(r->>'next_record_id')::uuid;
    perform 1 from public.financial_records where id in (source_id,target_id) order by id for share;
    select paid_at,household_id,owner_id,visibility into source_record from public.financial_records where id=source_id;
    if not found then raise exception 'BACKUP_PARENT_NOT_ACCESSIBLE'; end if;
    select household_id,owner_id,visibility into target_record from public.financial_records where id=target_id;
    if not found then raise exception 'BACKUP_PARENT_NOT_ACCESSIBLE'; end if;
    if not ((source_record.visibility='PRIVATE' and source_record.owner_id=auth.uid()) or (source_record.visibility='HOUSEHOLD_SHARED' and public.is_household_member(source_record.household_id))) or not ((target_record.visibility='PRIVATE' and target_record.owner_id=auth.uid()) or (target_record.visibility='HOUSEHOLD_SHARED' and public.is_household_member(target_record.household_id))) then raise exception 'BACKUP_PARENT_NOT_ACCESSIBLE'; end if;
    if source_record.paid_at is null or source_record.household_id is distinct from target_record.household_id or source_record.owner_id is distinct from target_record.owner_id or source_record.visibility is distinct from target_record.visibility then raise exception 'BACKUP_PARENT_CHANGED'; end if;
    if exists(select 1 from public.finance_recurrence_instances where paid_record_id=source_id) then skipped:=skipped+1; continue; end if;
    insert into public.finance_recurrence_instances (paid_record_id,next_record_id,created_at)
    select paid_record_id,next_record_id,created_at from jsonb_populate_record(null::public.finance_recurrence_instances,r);
   end if;
   get diagnostics n=row_count;
   if n<>1 then raise exception 'BACKUP_HISTORY_FAILED'; end if;
   inserted:=inserted+1;
  end loop;
 end loop;
 return jsonb_build_object('inserted',inserted,'skipped',skipped);
end $$;
revoke all on function public.mobile_restore_signed_history(jsonb,text) from public,anon;
grant execute on function public.mobile_restore_signed_history(jsonb,text) to authenticated;
