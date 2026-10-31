-- Archive categories for documents, separate from privacy and entity links.
alter table public.documents add column if not exists category text not null default 'OTHER';
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.documents'::regclass and conname = 'documents_category_check') then
    alter table public.documents add constraint documents_category_check check (category in ('IDENTITY','FINANCE','HOME','TRAVEL','OTHER'));
  end if;
end $$;
