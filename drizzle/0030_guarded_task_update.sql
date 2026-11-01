-- Compare the exact snapshot inside the same row lock/transaction as the edit.
create or replace function public.mobile_update_task_guarded(p_id uuid, p_input jsonb, p_expected_updated_at timestamptz)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare actual timestamptz;
begin
  if auth.uid() is null or p_expected_updated_at is null then raise exception 'INVALID_VERSION'; end if;
  select updated_at into actual from public.tasks where id=p_id and archived_at is null for update;
  if not found or actual is distinct from p_expected_updated_at then raise exception 'STALE_TASK'; end if;
  return public.mobile_update_task(p_id,p_input);
end $$;
revoke all on function public.mobile_update_task_guarded(uuid,jsonb,timestamptz) from public,anon;
grant execute on function public.mobile_update_task_guarded(uuid,jsonb,timestamptz) to authenticated;
