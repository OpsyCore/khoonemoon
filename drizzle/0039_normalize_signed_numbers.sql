-- jsonb preserves numeric scale (1.00), whereas JSON/JavaScript can transmit
-- the same value as 1. Canonicalize numeric scale before authenticating JSON.
-- Bound depth because signature verification accepts untrusted JSON.
create or replace function backup_private.canonical_json(p_value jsonb,p_depth integer default 0)
returns jsonb language plpgsql immutable strict security invoker set search_path=pg_catalog,backup_private as $$
declare t text:=jsonb_typeof(p_value); result jsonb;
begin
 if p_depth>16 then raise exception 'INVALID_BACKUP_DEPTH'; end if;
 if t='number' then return to_jsonb(trim_scale((p_value::text)::numeric)); end if;
 if t='object' then
  select coalesce(jsonb_object_agg(key,backup_private.canonical_json(value,p_depth+1)),'{}'::jsonb) into result from jsonb_each(p_value);
  return result;
 end if;
 if t='array' then
  select coalesce(jsonb_agg(backup_private.canonical_json(value,p_depth+1) order by ord),'[]'::jsonb) into result from jsonb_array_elements(p_value) with ordinality as a(value,ord);
  return result;
 end if;
 return p_value;
end $$;
revoke all on function backup_private.canonical_json(jsonb,integer) from public,anon,authenticated;
grant execute on function backup_private.canonical_json(jsonb,integer) to khoonemoon_backup_signer;

create or replace function public.mobile_signed_export_snapshot() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,backup_private as $$
declare payload jsonb;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
 payload:=jsonb_build_object('account_id',auth.uid(),'snapshot',public.mobile_export_snapshot());
 return jsonb_build_object('payload',payload,'signature',backup_private.sign_payload(backup_private.canonical_json(payload)::text));
end $$;
revoke all on function public.mobile_signed_export_snapshot() from public,anon;
grant execute on function public.mobile_signed_export_snapshot() to authenticated;

create or replace function public.mobile_verify_snapshot_signature(p_payload jsonb,p_signature text) returns boolean
language plpgsql stable security definer set search_path=pg_catalog,public,backup_private as $$
declare canonical bytea; legacy bytea; supplied bytea; mismatch integer:=0; legacy_mismatch integer:=0; i integer;
begin
 if auth.uid() is null or p_payload is null or octet_length(p_payload::text)>4*1024*1024+65536
    or p_payload->>'account_id' is distinct from auth.uid()::text
    or p_signature is null or p_signature !~ '^[0-9a-f]{64}$' then return false; end if;
 canonical:=decode(backup_private.sign_payload(backup_private.canonical_json(p_payload)::text),'hex');
 legacy:=decode(backup_private.sign_payload(p_payload::text),'hex'); supplied:=decode(p_signature,'hex');
 for i in 0..31 loop
  mismatch:=mismatch | (get_byte(canonical,i) # get_byte(supplied,i));
  legacy_mismatch:=legacy_mismatch | (get_byte(legacy,i) # get_byte(supplied,i));
 end loop;
 return mismatch=0 or legacy_mismatch=0;
end $$;
revoke all on function public.mobile_verify_snapshot_signature(jsonb,text) from public,anon;
grant execute on function public.mobile_verify_snapshot_signature(jsonb,text) to authenticated;
