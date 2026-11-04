-- Authenticate future archive metadata without granting a caller permission to
-- sign arbitrary content. The signer is a non-login role inheriting only the
-- ordinary authenticated grants, so export still runs through table RLS.
do $$
begin
  if not exists(select 1 from pg_roles where rolname='khoonemoon_backup_signer') then
    create role khoonemoon_backup_signer nologin inherit nosuperuser nobypassrls nocreatedb nocreaterole;
  elsif exists(select 1 from pg_roles where rolname='khoonemoon_backup_signer' and (rolcanlogin or rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or not rolinherit)) then
    raise exception 'unsafe backup signer role';
  end if;
  if exists(select 1 from pg_auth_members m join pg_roles r on r.oid=m.roleid join pg_roles u on u.oid=m.member where r.rolname='khoonemoon_backup_signer' and u.rolname<>'postgres') then raise exception 'unexpected backup signer member'; end if;
  if exists(select 1 from pg_auth_members m join pg_roles r on r.oid=m.roleid join pg_roles u on u.oid=m.member where u.rolname='khoonemoon_backup_signer' and r.rolname<>'authenticated') then raise exception 'unexpected backup signer privilege'; end if;
end $$;
-- PostgreSQL 16+ grants CREATEROLE users only ADMIN on roles they create;
-- SET membership is required to transfer function ownership to that role.
grant khoonemoon_backup_signer to postgres;
grant authenticated to khoonemoon_backup_signer;
-- ALTER FUNCTION OWNER requires the new owner to temporarily have CREATE.
grant create on schema public to khoonemoon_backup_signer;
create schema if not exists backup_private;
revoke all on schema backup_private from public, anon, authenticated;
grant usage on schema backup_private to khoonemoon_backup_signer;
create table if not exists backup_private.signing_key (id boolean primary key default true check(id), secret text not null);
revoke all on backup_private.signing_key from public, anon, authenticated;
insert into backup_private.signing_key(id,secret) values (true, gen_random_uuid()::text || gen_random_uuid()::text) on conflict (id) do nothing;
grant select on backup_private.signing_key to khoonemoon_backup_signer;

-- RFC 2104 HMAC-SHA256 using PostgreSQL's built-in SHA256 implementation.
create or replace function backup_private.sign_payload(p_payload text) returns text
language plpgsql stable security invoker set search_path=pg_catalog,backup_private as $$
declare k bytea; ipad bytea:=decode(repeat('36',64),'hex'); opad bytea:=decode(repeat('5c',64),'hex'); i integer;
begin
 select sha256(convert_to(secret,'UTF8')) into strict k from backup_private.signing_key where id;
 for i in 0..31 loop
   ipad:=set_byte(ipad,i,get_byte(ipad,i) # get_byte(k,i));
   opad:=set_byte(opad,i,get_byte(opad,i) # get_byte(k,i));
 end loop;
 return encode(sha256(opad || sha256(ipad || convert_to(p_payload,'UTF8'))),'hex');
end $$;
revoke all on function backup_private.sign_payload(text) from public, anon, authenticated;
grant execute on function backup_private.sign_payload(text) to khoonemoon_backup_signer;

create or replace function public.mobile_signed_export_snapshot() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,backup_private as $$
declare payload jsonb;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
 payload:=jsonb_build_object('account_id',auth.uid(),'snapshot',public.mobile_export_snapshot());
 return jsonb_build_object('payload',payload,'signature',backup_private.sign_payload(payload::text));
end $$;
alter function public.mobile_signed_export_snapshot() owner to khoonemoon_backup_signer;
revoke all on function public.mobile_signed_export_snapshot() from public, anon;
grant execute on function public.mobile_signed_export_snapshot() to authenticated;

-- This validates a signature, not permission to perform any restore. Callers
-- cannot sign arbitrary JSON and a signature never bypasses current RLS.
create or replace function public.mobile_verify_snapshot_signature(p_payload jsonb,p_signature text) returns boolean
language plpgsql stable security definer set search_path=pg_catalog,public,backup_private as $$
declare actual bytea; supplied bytea; mismatch integer:=0; i integer;
begin
 if auth.uid() is null or p_payload is null or octet_length(p_payload::text)>4*1024*1024+65536
    or p_payload->>'account_id' is distinct from auth.uid()::text
    or p_signature is null or p_signature !~ '^[0-9a-f]{64}$' then return false; end if;
 actual:=decode(backup_private.sign_payload(p_payload::text),'hex'); supplied:=decode(p_signature,'hex');
 for i in 0..31 loop mismatch:=mismatch | (get_byte(actual,i) # get_byte(supplied,i)); end loop;
 return mismatch=0;
end $$;
alter function public.mobile_verify_snapshot_signature(jsonb,text) owner to khoonemoon_backup_signer;
revoke all on function public.mobile_verify_snapshot_signature(jsonb,text) from public, anon;
grant execute on function public.mobile_verify_snapshot_signature(jsonb,text) to authenticated;
revoke create on schema public from khoonemoon_backup_signer;
