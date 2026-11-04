create or replace function public.current_user_can_create_reminder(
  p_target_type public.reminder_target_type, p_target_id uuid, p_household_id uuid
) returns boolean language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $$
begin
  if auth.uid() is null then return false; end if;
  if p_target_type = 'TASK' then return public.current_user_can_access_task(p_target_id); end if;
  if p_target_type = 'EVENT' then return public.current_user_can_access_event(p_target_id); end if;
  if p_target_type = 'CHORE' then
    return exists(select 1 from public.chores c where c.id=p_target_id and c.archived_at is null and c.household_id is not distinct from p_household_id and public.is_household_member(c.household_id));
  end if;
  if p_target_type = 'BILL' then
    return exists(select 1 from public.financial_records r where r.id=p_target_id and r.archived_at is null and r.record_type in ('BILL','SUBSCRIPTION','INSTALLMENT') and r.household_id is not distinct from p_household_id and ((r.visibility='PRIVATE' and r.owner_id=auth.uid()) or (r.visibility='HOUSEHOLD_SHARED' and public.is_household_member(r.household_id))));
  end if;
  return false;
end $$;
revoke all on function public.current_user_can_create_reminder(public.reminder_target_type,uuid,uuid) from public, anon;
grant execute on function public.current_user_can_create_reminder(public.reminder_target_type,uuid,uuid) to authenticated;
