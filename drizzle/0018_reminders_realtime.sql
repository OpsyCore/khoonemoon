-- Realtime SELECT access remains governed by each table's existing RLS.
-- The client re-fetches authorized rows and falls back to polling while open.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reminders') then
      alter publication supabase_realtime add table public.reminders;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notification_preferences') then
      alter publication supabase_realtime add table public.notification_preferences;
    end if;
  end if;
end
$$;
