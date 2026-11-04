-- Realtime respects existing SELECT RLS. Clients reload authorized rows rather
-- than displaying event payloads; a periodic refresh also covers DELETE events.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'financial_records') then
    alter publication supabase_realtime add table public.financial_records;
  end if;
end
$$;
