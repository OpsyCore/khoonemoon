-- Retired paths cannot be re-used. Storage and document writers take the same
-- transaction lock as cleanup, preventing a pending upload/metadata insert
-- from crossing the final reference check. Bytes are deleted only via the
-- Storage API after a deliberate per-file request; SQL never deletes objects.
create table if not exists backup_private.retired_document_paths (
 path text primary key,
 marked_by uuid not null,
 marked_at timestamptz not null default now()
);
revoke all on backup_private.retired_document_paths from public,anon,authenticated;

create or replace function backup_private.guard_document_path()
returns trigger language plpgsql security definer set search_path=pg_catalog,backup_private as $$
begin
 if tg_table_schema='storage' then
  if tg_op='UPDATE' and old.bucket_id='documents' then
   perform pg_advisory_xact_lock(hashtextextended('document-path:'||old.name,0));
   if exists(select 1 from backup_private.retired_document_paths where path=old.name) then raise exception 'DOCUMENT_PATH_RETIRED'; end if;
  end if;
  if new.bucket_id <> 'documents' then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('document-path:'||new.name,0));
  if exists(select 1 from backup_private.retired_document_paths where path=new.name) then raise exception 'DOCUMENT_PATH_RETIRED'; end if;
  -- Treat any object metadata write as recent; conservatively delay cleanup.
  if tg_op='UPDATE' then new.updated_at:=greatest(coalesce(new.updated_at,now()),now()); end if;
 else
  perform pg_advisory_xact_lock(hashtextextended('document-path:'||new.storage_path,0));
  if exists(select 1 from backup_private.retired_document_paths where path=new.storage_path) then raise exception 'DOCUMENT_PATH_RETIRED'; end if;
 end if;
 return new;
end $$;
revoke all on function backup_private.guard_document_path() from public,anon,authenticated;
drop trigger if exists documents_guard_retired_path on public.documents;
create trigger documents_guard_retired_path before insert or update of storage_path on public.documents for each row execute function backup_private.guard_document_path();
drop trigger if exists documents_storage_guard_retired_path on storage.objects;
create trigger documents_storage_guard_retired_path before insert or update on storage.objects for each row execute function backup_private.guard_document_path();

-- Authorization is deliberately limited to the user's own private namespace or
-- their active owner-owned household. Never cast attacker-controlled strings.
create or replace function backup_private.cleanup_allowed(p_path text)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select auth.uid() is not null and p_path is not null and length(p_path) between 8 and 500 and (
   p_path like ('user/' || auth.uid()::text || '/%') or
   exists(select 1 from public.household_members m where m.user_id=auth.uid() and m.role='OWNER' and m.left_at is null and p_path like ('household/' || m.household_id::text || '/%'))
 );
$$;
revoke all on function backup_private.cleanup_allowed(text) from public,anon,authenticated;

create or replace function public.mark_document_orphan_for_cleanup(p_path text)
returns boolean language plpgsql security definer set search_path=pg_catalog,public,storage,backup_private as $$
declare modified timestamptz;
begin
 if not backup_private.cleanup_allowed(p_path) then raise exception 'CLEANUP_FORBIDDEN'; end if;
 -- Lock membership against removal while checking and marking.
 perform 1 from public.household_members where user_id=auth.uid() and role='OWNER' and left_at is null for share;
 if not backup_private.cleanup_allowed(p_path) then raise exception 'CLEANUP_FORBIDDEN'; end if;
 perform pg_advisory_xact_lock(hashtextextended('document-path:'||p_path,0));
 if exists(select 1 from public.documents where storage_path=p_path) then raise exception 'DOCUMENT_REFERENCED'; end if;
 if exists(select 1 from backup_private.retired_document_paths where path=p_path) then return true; end if;
 select greatest(o.created_at,coalesce(o.updated_at,o.created_at)) into modified from storage.objects o where o.bucket_id='documents' and o.name=p_path for share;
 if modified is null or modified>=now()-interval '7 days' then raise exception 'NOT_OLD_OR_MISSING'; end if;
 insert into backup_private.retired_document_paths(path,marked_by) values(p_path,auth.uid());
 return true;
end $$;
revoke all on function public.mark_document_orphan_for_cleanup(text) from public,anon;
grant execute on function public.mark_document_orphan_for_cleanup(text) to authenticated;

create or replace function public.document_cleanup_is_retired(p_path text)
returns boolean language plpgsql stable security definer set search_path=pg_catalog,public,backup_private as $$
begin
 if auth.uid() is null or p_path is null or length(p_path)>500 or not (
   p_path like ('user/'||auth.uid()::text||'/%') or exists(select 1 from public.household_members m where m.user_id=auth.uid() and m.left_at is null and p_path like ('household/'||m.household_id::text||'/%'))
 ) then raise exception 'CLEANUP_FORBIDDEN'; end if;
 return exists(select 1 from backup_private.retired_document_paths where path=p_path);
end $$;
revoke all on function public.document_cleanup_is_retired(text) from public,anon;
grant execute on function public.document_cleanup_is_retired(text) to authenticated;

create or replace function public.document_cleanup_confirm(p_path text)
returns boolean language plpgsql stable security definer set search_path=pg_catalog,public,storage,backup_private as $$
begin
 if not backup_private.cleanup_allowed(p_path) then raise exception 'CLEANUP_FORBIDDEN'; end if;
 return exists(select 1 from backup_private.retired_document_paths where path=p_path)
   and not exists(select 1 from storage.objects where bucket_id='documents' and name=p_path)
   and not exists(select 1 from public.documents where storage_path=p_path);
end $$;
revoke all on function public.document_cleanup_confirm(text) from public,anon;
grant execute on function public.document_cleanup_confirm(text) to authenticated;
