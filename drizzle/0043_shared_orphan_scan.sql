-- Read-only diagnostics. Cross-RLS reference checks are intentional: a file
-- must not be called unreferenced merely because its document is not visible
-- to the caller. No Storage objects are deleted or modified here.
create or replace function public.possible_orphan_documents()
returns table(path text, uploaded_at timestamptz)
language sql stable security definer set search_path=pg_catalog,public,storage as $$
  select o.name, greatest(o.created_at,coalesce(o.updated_at,o.created_at))
  from storage.objects o
  where auth.uid() is not null and o.bucket_id='documents'
    and o.name like ('user/' || auth.uid()::text || '/%')
    and greatest(o.created_at,coalesce(o.updated_at,o.created_at)) < now()-interval '7 days'
    and not exists(select 1 from public.documents d where d.storage_path=o.name)
  order by 2,o.name limit 100;
$$;
revoke all on function public.possible_orphan_documents() from public,anon;
grant execute on function public.possible_orphan_documents() to authenticated;

create or replace function public.possible_shared_orphan_documents(p_household uuid)
returns table(path text, uploaded_at timestamptz)
language plpgsql stable security definer set search_path=pg_catalog,public,storage as $$
begin
  if auth.uid() is null or p_household is null or not public.is_household_owner(p_household) then
    raise exception 'OWNER_REQUIRED';
  end if;
  return query select o.name, greatest(o.created_at,coalesce(o.updated_at,o.created_at))
    from storage.objects o
    where o.bucket_id='documents' and o.name like ('household/' || p_household::text || '/%')
      and greatest(o.created_at,coalesce(o.updated_at,o.created_at)) < now()-interval '7 days'
      and not exists(select 1 from public.documents d where d.storage_path=o.name)
    order by 2,o.name limit 100;
end $$;
revoke all on function public.possible_shared_orphan_documents(uuid) from public,anon;
grant execute on function public.possible_shared_orphan_documents(uuid) to authenticated;
