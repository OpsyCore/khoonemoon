-- Runtime secrets never ship in app builds or Git. The edge worker creates its
-- VAPID pair once; only service_role can read it. A short-lived, one-use nonce
-- protects the scheduler endpoint without putting service-role keys in pg_net.
create table if not exists backup_private.push_vapid (
 id boolean primary key default true check (id), public_key text not null, private_key text not null,
 created_at timestamptz not null default now()
);
create table if not exists backup_private.push_nonces (
 digest bytea primary key, expires_at timestamptz not null
);
revoke all on backup_private.push_vapid,backup_private.push_nonces from public,anon,authenticated;

create or replace function public.standalone_push_vapid(p_public text,p_private text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,backup_private as $$
declare result jsonb;
begin
 select jsonb_build_object('public_key',public_key,'private_key',private_key) into result from backup_private.push_vapid where id;
 if result is not null then return result; end if;
 if p_public is null and p_private is null then return null; end if;
 if p_public is null or p_private is null or p_public !~ '^[A-Za-z0-9_-]{87}$' or p_private !~ '^[A-Za-z0-9_-]{43}$' then raise exception 'INVALID_VAPID'; end if;
 insert into backup_private.push_vapid(id,public_key,private_key) values(true,p_public,p_private) on conflict(id) do nothing;
 select jsonb_build_object('public_key',public_key,'private_key',private_key) into result from backup_private.push_vapid where id;
 return result;
end $$;
revoke all on function public.standalone_push_vapid(text,text) from public,anon,authenticated;
grant execute on function public.standalone_push_vapid(text,text) to service_role;

create or replace function public.standalone_push_consume_nonce(p_nonce text)
returns boolean language plpgsql security definer set search_path=pg_catalog,backup_private as $$
declare n integer;
begin
 if p_nonce is null or p_nonce !~ '^[0-9a-f]{64}$' then return false; end if;
 delete from backup_private.push_nonces where digest=sha256(convert_to(p_nonce,'UTF8')) and expires_at>now();
 get diagnostics n=row_count;
 return n=1;
end $$;
revoke all on function public.standalone_push_consume_nonce(text) from public,anon,authenticated;
grant execute on function public.standalone_push_consume_nonce(text) to service_role;

-- The public key alone is not secret. No key means the worker is not ready.
create or replace function public.standalone_push_public_key()
returns text language sql stable security definer set search_path=pg_catalog,backup_private as $$
 select public_key from backup_private.push_vapid where id;
$$;
revoke all on function public.standalone_push_public_key() from public,anon;
grant execute on function public.standalone_push_public_key() to authenticated;
