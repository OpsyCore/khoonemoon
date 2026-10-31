-- Keep file privacy aligned with the metadata's visibility, even for clients
-- bypassing our application and writing directly through the REST API.
drop policy if exists "documents_insert_create" on public.documents;
create policy "documents_insert_create"
on public.documents for insert to authenticated
with check (
  created_by = auth.uid()
  and (
    (visibility = 'PRIVATE' and household_id is null
      and storage_path like ('user/' || auth.uid()::text || '/%'))
    or
    (visibility = 'HOUSEHOLD_SHARED' and household_id is not null
      and public.is_household_member(household_id)
      and storage_path like ('household/' || household_id::text || '/%'))
  )
);
