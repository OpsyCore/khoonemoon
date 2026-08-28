-- Milestone 12: Documents & Attachments
-- New tables only. Does not ALTER M8 shopping / M9 finance / tasks / events / chores.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'document_visibility') then
    create type public.document_visibility as enum ('PRIVATE', 'HOUSEHOLD_SHARED');
  end if;

  if not exists (select 1 from pg_type where typname = 'document_entity_type') then
    create type public.document_entity_type as enum (
      'TASK',
      'EVENT',
      'CHORE',
      'SHOPPING_LIST',
      'FINANCE_RECORD'
    );
  end if;
end
$$;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null,
  description text,
  mime_type text not null,
  file_size integer not null,
  storage_path text not null,
  visibility public.document_visibility not null default 'PRIVATE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint documents_visibility_household_check check (
    (visibility = 'PRIVATE' and household_id is null)
    or
    (visibility = 'HOUSEHOLD_SHARED' and household_id is not null)
  ),

  constraint documents_title_check
    check (char_length(trim(title)) between 1 and 180),

  constraint documents_description_check
    check (description is null or char_length(description) <= 1000),

  constraint documents_mime_type_check
    check (mime_type in (
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp'
    )),

  constraint documents_file_size_check
    check (file_size > 0 and file_size <= 10485760),

  constraint documents_storage_path_check
    check (char_length(trim(storage_path)) between 8 and 500),

  constraint documents_storage_path_unique unique (storage_path)
);

create index if not exists documents_created_by_created_idx
  on public.documents (created_by, created_at desc);

create index if not exists documents_household_visibility_idx
  on public.documents (household_id, visibility, created_at desc);

create table if not exists public.document_attachments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  entity_type public.document_entity_type not null,
  entity_id uuid not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),

  constraint document_attachments_unique_link
    unique (document_id, entity_type, entity_id)
);

create index if not exists document_attachments_entity_idx
  on public.document_attachments (entity_type, entity_id);

create index if not exists document_attachments_document_idx
  on public.document_attachments (document_id);

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
before update on public.documents
for each row
execute function public.set_current_timestamp_updated_at();

create or replace function public.protect_document_immutable_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
     or new.created_by is distinct from old.created_by
     or new.household_id is distinct from old.household_id
     or new.visibility is distinct from old.visibility
     or new.storage_path is distinct from old.storage_path
     or new.mime_type is distinct from old.mime_type
     or new.file_size is distinct from old.file_size
     or new.created_at is distinct from old.created_at then
    raise exception 'DOCUMENT_IMMUTABLE_FIELDS';
  end if;

  return new;
end;
$$;

drop trigger if exists documents_protect_immutable on public.documents;
create trigger documents_protect_immutable
before update on public.documents
for each row
execute function public.protect_document_immutable_fields();

create or replace function public.current_user_can_access_document_entity(
  p_type public.document_entity_type,
  p_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case p_type
    when 'TASK' then exists (
      select 1
      from public.tasks t
      where t.id = p_id
        and (
          (t.visibility = 'PRIVATE' and t.owner_id = auth.uid())
          or (
            t.visibility = 'HOUSEHOLD_SHARED'
            and public.is_household_member(t.household_id)
          )
        )
    )
    when 'EVENT' then exists (
      select 1
      from public.events e
      where e.id = p_id
        and (
          (e.visibility = 'PRIVATE' and e.owner_id = auth.uid())
          or (
            e.visibility = 'HOUSEHOLD_SHARED'
            and public.is_household_member(e.household_id)
          )
        )
    )
    when 'CHORE' then exists (
      select 1
      from public.chores c
      where c.id = p_id
        and public.is_household_member(c.household_id)
    )
    when 'SHOPPING_LIST' then exists (
      select 1
      from public.shopping_lists l
      where l.id = p_id
        and public.is_household_member(l.household_id)
    )
    when 'FINANCE_RECORD' then exists (
      select 1
      from public.finance_records r
      where r.id = p_id
        and (
          (r.visibility = 'PRIVATE' and r.owner_id = auth.uid())
          or (
            r.visibility = 'HOUSEHOLD_SHARED'
            and public.is_household_member(r.household_id)
          )
        )
    )
    else false
  end;
$$;

alter table public.documents enable row level security;
alter table public.document_attachments enable row level security;

drop policy if exists "documents_select_access" on public.documents;
create policy "documents_select_access"
on public.documents
for select
to authenticated
using (
  (visibility = 'PRIVATE' and created_by = auth.uid())
  or
  (visibility = 'HOUSEHOLD_SHARED' and public.is_household_member(household_id))
);

drop policy if exists "documents_insert_create" on public.documents;
create policy "documents_insert_create"
on public.documents
for insert
to authenticated
with check (
  created_by = auth.uid()
  and (
    (visibility = 'PRIVATE' and household_id is null)
    or
    (
      visibility = 'HOUSEHOLD_SHARED'
      and household_id is not null
      and public.is_household_member(household_id)
    )
  )
);

drop policy if exists "documents_update_manage" on public.documents;
create policy "documents_update_manage"
on public.documents
for update
to authenticated
using (
  (visibility = 'PRIVATE' and created_by = auth.uid())
  or
  (visibility = 'HOUSEHOLD_SHARED' and public.is_household_member(household_id))
)
with check (
  (visibility = 'PRIVATE' and created_by = auth.uid() and household_id is null)
  or
  (
    visibility = 'HOUSEHOLD_SHARED'
    and household_id is not null
    and public.is_household_member(household_id)
  )
);

drop policy if exists "documents_delete_manage" on public.documents;
create policy "documents_delete_manage"
on public.documents
for delete
to authenticated
using (
  (visibility = 'PRIVATE' and created_by = auth.uid())
  or
  (visibility = 'HOUSEHOLD_SHARED' and public.is_household_member(household_id))
);

drop policy if exists "document_attachments_select_access" on public.document_attachments;
create policy "document_attachments_select_access"
on public.document_attachments
for select
to authenticated
using (
  exists (
    select 1
    from public.documents d
    where d.id = document_attachments.document_id
      and (
        (d.visibility = 'PRIVATE' and d.created_by = auth.uid())
        or (
          d.visibility = 'HOUSEHOLD_SHARED'
          and public.is_household_member(d.household_id)
        )
      )
  )
  and public.current_user_can_access_document_entity(
    document_attachments.entity_type,
    document_attachments.entity_id
  )
);

drop policy if exists "document_attachments_insert_create" on public.document_attachments;
create policy "document_attachments_insert_create"
on public.document_attachments
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.documents d
    where d.id = document_attachments.document_id
      and (
        (d.visibility = 'PRIVATE' and d.created_by = auth.uid())
        or (
          d.visibility = 'HOUSEHOLD_SHARED'
          and public.is_household_member(d.household_id)
        )
      )
  )
  and public.current_user_can_access_document_entity(
    document_attachments.entity_type,
    document_attachments.entity_id
  )
);

drop policy if exists "document_attachments_delete_manage" on public.document_attachments;
create policy "document_attachments_delete_manage"
on public.document_attachments
for delete
to authenticated
using (
  exists (
    select 1
    from public.documents d
    where d.id = document_attachments.document_id
      and (
        (d.visibility = 'PRIVATE' and d.created_by = auth.uid())
        or (
          d.visibility = 'HOUSEHOLD_SHARED'
          and public.is_household_member(d.household_id)
        )
      )
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "documents_storage_select" on storage.objects;
create policy "documents_storage_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'documents'
  and (
    (
      (storage.foldername(name))[1] = 'user'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
    or (
      (storage.foldername(name))[1] = 'household'
      and public.is_household_member(((storage.foldername(name))[2])::uuid)
    )
  )
);

drop policy if exists "documents_storage_insert" on storage.objects;
create policy "documents_storage_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'documents'
  and (
    (
      (storage.foldername(name))[1] = 'user'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
    or (
      (storage.foldername(name))[1] = 'household'
      and public.is_household_member(((storage.foldername(name))[2])::uuid)
    )
  )
);

drop policy if exists "documents_storage_update" on storage.objects;
create policy "documents_storage_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'documents'
  and (
    (
      (storage.foldername(name))[1] = 'user'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
    or (
      (storage.foldername(name))[1] = 'household'
      and public.is_household_member(((storage.foldername(name))[2])::uuid)
    )
  )
)
with check (
  bucket_id = 'documents'
  and (
    (
      (storage.foldername(name))[1] = 'user'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
    or (
      (storage.foldername(name))[1] = 'household'
      and public.is_household_member(((storage.foldername(name))[2])::uuid)
    )
  )
);

drop policy if exists "documents_storage_delete" on storage.objects;
create policy "documents_storage_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'documents'
  and (
    (
      (storage.foldername(name))[1] = 'user'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
    or (
      (storage.foldername(name))[1] = 'household'
      and public.is_household_member(((storage.foldername(name))[2])::uuid)
    )
  )
);

revoke all on table public.documents from anon;
revoke all on table public.document_attachments from anon;
revoke all on table public.documents from authenticated;
revoke all on table public.document_attachments from authenticated;

grant select, insert, update, delete
  on table public.documents
  to authenticated;

grant select, insert, delete
  on table public.document_attachments
  to authenticated;

revoke all on function public.protect_document_immutable_fields() from public;

revoke all on function public.current_user_can_access_document_entity(
  public.document_entity_type,
  uuid
) from public;
revoke all on function public.current_user_can_access_document_entity(
  public.document_entity_type,
  uuid
) from anon;
grant execute on function public.current_user_can_access_document_entity(
  public.document_entity_type,
  uuid
) to authenticated;
