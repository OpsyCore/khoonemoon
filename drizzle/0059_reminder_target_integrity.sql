-- Preserve legacy API shapes while preventing cross-house links and retargeting.
-- Orphaned reminders can still be snoozed/cancelled/deleted after target removal.
create or replace function public.current_user_can_create_reminder(
  p_target_type public.reminder_target_type, p_target_id uuid, p_household_id uuid
) returns boolean language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $$
begin
  if auth.uid() is null then return false; end if;
  if p_target_type='TASK' then
    return exists(select 1 from public.tasks t where t.id=p_target_id and t.household_id is not distinct from p_household_id and public.current_user_can_access_task(t.id));
  end if;
  if p_target_type='EVENT' then
    return exists(select 1 from public.events e where e.id=p_target_id and e.household_id is not distinct from p_household_id and public.current_user_can_access_event(e.id));
  end if;
  if p_target_type='CHORE' then
    return exists(select 1 from public.chores c where c.id=p_target_id and c.archived_at is null and c.household_id is not distinct from p_household_id and public.is_household_member(c.household_id));
  end if;
  if p_target_type='BILL' then
    return exists(select 1 from public.financial_records r where r.id=p_target_id and r.archived_at is null and r.record_type in ('BILL','SUBSCRIPTION','INSTALLMENT') and r.household_id is not distinct from p_household_id and ((r.visibility='PRIVATE' and r.owner_id=auth.uid()) or (r.visibility='HOUSEHOLD_SHARED' and public.is_household_member(r.household_id))));
  end if;
  return false;
end $$;
revoke all on function public.current_user_can_create_reminder(public.reminder_target_type,uuid,uuid) from public,anon;
grant execute on function public.current_user_can_create_reminder(public.reminder_target_type,uuid,uuid) to authenticated;

-- Do not trust the broad update-own RLS policy to protect target identity.
create or replace function public.protect_reminder_identity() returns trigger
language plpgsql set search_path=pg_catalog,public,pg_temp as $$
begin
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id
    or new.target_type is distinct from old.target_type or new.target_id is distinct from old.target_id
    or new.household_id is distinct from old.household_id or new.created_at is distinct from old.created_at then
    raise exception 'REMINDER_IDENTITY_IMMUTABLE';
  end if;
  return new;
end $$;
revoke all on function public.protect_reminder_identity() from public,anon,authenticated;
drop trigger if exists protect_reminder_identity on public.reminders;
create trigger protect_reminder_identity before update on public.reminders for each row execute function public.protect_reminder_identity();
