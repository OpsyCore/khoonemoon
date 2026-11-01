-- The Today screen completes the exact occurrence it displayed. Locking the row
-- before comparing avoids advancing the next occurrence on a concurrent retry.
create or replace function public.complete_chore_expected_due(p_chore_id uuid, p_expected_due timestamptz)
returns uuid
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare v_chore public.chores%rowtype; v_completion uuid;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.current_user_can_access_chore(p_chore_id) then raise exception 'CHORE_NOT_FOUND_OR_FORBIDDEN'; end if;
  select * into v_chore from public.chores where id=p_chore_id for update;
  if v_chore.id is null or not public.is_household_member(v_chore.household_id) then raise exception 'CHORE_NOT_FOUND_OR_FORBIDDEN'; end if;
  if not v_chore.is_active or v_chore.archived_at is not null then raise exception 'CHORE_INACTIVE'; end if;
  if p_expected_due is null or v_chore.next_due_at is distinct from p_expected_due then raise exception 'CHORE_OCCURRENCE_CHANGED'; end if;
  select c.completion_id into v_completion from public.complete_chore(p_chore_id) c;
  return v_completion;
end $$;
revoke all on function public.complete_chore_expected_due(uuid,timestamptz) from public, anon;
grant execute on function public.complete_chore_expected_due(uuid,timestamptz) to authenticated;
