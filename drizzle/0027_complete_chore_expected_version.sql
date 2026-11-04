-- Use a monotonic row revision rather than timestamps, which may be identical
-- across updates in the same transaction or across concurrently started requests.
alter table public.chores add column if not exists completion_revision bigint not null default 0;
create or replace function public.bump_chore_revision() returns trigger
language plpgsql set search_path=pg_catalog,public,pg_temp as $$
begin
  new.completion_revision := old.completion_revision + 1;
  return new;
end $$;
drop trigger if exists bump_chore_revision on public.chores;
create trigger bump_chore_revision before update on public.chores for each row execute function public.bump_chore_revision();
revoke all on function public.bump_chore_revision() from public, anon, authenticated;
create or replace function public.complete_chore_expected_version(p_chore_id uuid, p_expected_version bigint)
returns uuid language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_chore public.chores%rowtype; v_completion uuid;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.current_user_can_access_chore(p_chore_id) then raise exception 'CHORE_NOT_FOUND_OR_FORBIDDEN'; end if;
  select * into v_chore from public.chores where id=p_chore_id for update;
  if v_chore.id is null or not public.is_household_member(v_chore.household_id) then raise exception 'CHORE_NOT_FOUND_OR_FORBIDDEN'; end if;
  if not v_chore.is_active or v_chore.archived_at is not null then raise exception 'CHORE_INACTIVE'; end if;
  if p_expected_version is null or v_chore.completion_revision is distinct from p_expected_version then raise exception 'CHORE_VERSION_CHANGED'; end if;
  select c.completion_id into v_completion from public.complete_chore(p_chore_id) c;
  return v_completion;
end $$;
revoke all on function public.complete_chore_expected_version(uuid,bigint) from public, anon;
grant execute on function public.complete_chore_expected_version(uuid,bigint) to authenticated;
