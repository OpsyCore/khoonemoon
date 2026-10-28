-- Local/CI only shim: recreates the parts of Supabase that our migrations use.
--
-- NEVER run this against a Supabase project. It exists so that `drizzle/*.sql`
-- can be applied to a plain Postgres container in CI (which catches ordering
-- bugs, missing grants and broken RLS policies before they reach production).
--
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/local/00_auth_shim.sql

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;

  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    create schema auth;
  end if;
end
$$;

create table if not exists auth.users (
  id uuid primary key,
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Mirrors Supabase's auth.uid(): reads the JWT claims a request would carry.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    current_setting('request.jwt.claims', true)::jsonb ->> 'sub',
    ''
  )::uuid;
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
