-- Expose only display names of active members of the caller's household.
-- Profile rows themselves remain private under existing RLS policies.
create or replace function public.household_member_names(target_household_id uuid)
returns table (id uuid, full_name text)
language sql stable security definer
set search_path = public
as $$
  select hm.user_id, p.full_name
  from public.household_members hm
  join public.profiles p on p.id = hm.user_id
  where hm.household_id = target_household_id
    and hm.left_at is null
    and public.is_household_member(target_household_id);
$$;
revoke all on function public.household_member_names(uuid) from public, anon;
grant execute on function public.household_member_names(uuid) to authenticated;
