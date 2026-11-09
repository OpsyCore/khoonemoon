-- The SECURITY DEFINER compatibility helper is executable by authenticated
-- users for the attachment RLS policy. Bind both sides to caller-visible rows
-- so arbitrary household/entity IDs cannot be used as an existence oracle.
create or replace function public.document_entity_household_compatible(
  p_doc_household uuid,
  p_type public.document_entity_type,
  p_id uuid
) returns boolean language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select case
    when auth.uid() is null then false
    when p_doc_household is not null
      and not public.is_household_member(p_doc_household) then false
    when not public.current_user_can_access_document_entity(p_type, p_id) then false
    when p_doc_household is null then true
    when p_type = 'TASK' then exists (
      select 1 from public.tasks t
      where t.id = p_id and (t.household_id is null or t.household_id = p_doc_household)
    )
    when p_type = 'EVENT' then exists (
      select 1 from public.events e
      where e.id = p_id and (e.household_id is null or e.household_id = p_doc_household)
    )
    when p_type = 'CHORE' then exists (
      select 1 from public.chores c where c.id = p_id and c.household_id = p_doc_household
    )
    when p_type = 'SHOPPING_LIST' then exists (
      select 1 from public.shopping_lists l where l.id = p_id and l.household_id = p_doc_household
    )
    when p_type = 'FINANCE_RECORD' then exists (
      select 1 from public.financial_records r
      where r.id = p_id and (r.household_id is null or r.household_id = p_doc_household)
    )
    when p_type = 'APPLIANCE' then exists (
      select 1 from public.home_appliances a
      where a.id = p_id and (a.household_id is null or a.household_id = p_doc_household)
    )
    else false
  end;
$$;
revoke all on function public.document_entity_household_compatible(
  uuid, public.document_entity_type, uuid
) from public, anon;
grant execute on function public.document_entity_household_compatible(
  uuid, public.document_entity_type, uuid
) to authenticated;
