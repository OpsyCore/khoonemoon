-- Read-only diagnostic, never deletion: upload/metadata writes can be delayed.
-- Only the caller's private prefix is scanned, under both Storage and document RLS.
create or replace function public.possible_orphan_documents()
returns table(path text, uploaded_at timestamptz)
language sql stable security invoker set search_path=pg_catalog,public,storage as $$
  select o.name, o.created_at from storage.objects o
  where auth.uid() is not null and o.bucket_id='documents'
    and o.name like ('user/' || auth.uid()::text || '/%')
    and o.created_at < now()-interval '7 days'
    and not exists(select 1 from public.documents d where d.storage_path=o.name)
  order by o.created_at,o.name limit 100;
$$;
revoke all on function public.possible_orphan_documents() from public,anon;
grant execute on function public.possible_orphan_documents() to authenticated;
