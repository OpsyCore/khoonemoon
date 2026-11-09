-- Versioned backup APIs keep the existing 19-table snapshots usable by old apps.
create or replace function public.mobile_export_snapshot_v2() returns jsonb
language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare base jsonb; rows_json jsonb; n bigint;
begin
 base:=public.mobile_export_snapshot();
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb),count(*) into rows_json,n from
  (select id,household_id,created_by,meal_date,meal_type,title,minutes,assignee,ingredients,image_choice,created_at,updated_at from public.meal_plans order by id limit 10001) r;
 if n>10000 then raise exception 'EXPORT_ROW_LIMIT'; end if;
 base:=jsonb_set(base,'{tables,meal_plans}',rows_json,true);
 base:=jsonb_set(base,'{counts,meal_plans}',to_jsonb(n),true);
 if octet_length((base->'tables')::text)>4*1024*1024 then raise exception 'EXPORT_SIZE_LIMIT'; end if;
 return base;
end $$;
revoke all on function public.mobile_export_snapshot_v2() from public,anon;
grant execute on function public.mobile_export_snapshot_v2() to authenticated;

-- Signer has only authenticated/RLS access; the existing signature validator is unchanged.
grant create on schema public to khoonemoon_backup_signer;
create or replace function public.mobile_signed_export_snapshot_v2() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,backup_private as $$
declare payload jsonb;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
 payload:=jsonb_build_object('account_id',auth.uid(),'snapshot',public.mobile_export_snapshot_v2());
 return jsonb_build_object('payload',payload,'signature',backup_private.sign_payload(backup_private.canonical_json(payload)::text));
end $$;
alter function public.mobile_signed_export_snapshot_v2() owner to khoonemoon_backup_signer;
revoke all on function public.mobile_signed_export_snapshot_v2() from public,anon;
grant execute on function public.mobile_signed_export_snapshot_v2() to authenticated;
revoke create on schema public from khoonemoon_backup_signer;

-- Restore only signed original rows; never overwrite existing records. Other
-- authors' rows require an owner both in the signed source and current home.
create or replace function public.mobile_restore_signed_meals(p_payload jsonb,p_signature text,p_source uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,backup_private as $$
declare uid uuid:=auth.uid(); target uuid; source_owner boolean; current_owner boolean; items jsonb; r jsonb; row_id uuid; existing_home uuid; n int; inserted int:=0; skipped int:=0; deferred int:=0;
begin
 if uid is null or p_source is null or not public.mobile_verify_snapshot_signature(p_payload,p_signature) then raise exception 'INVALID_BACKUP_SIGNATURE'; end if;
 items:=p_payload->'snapshot'->'tables'->'meal_plans';
 if jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items)>10000 then raise exception 'INVALID_MEAL_BACKUP'; end if;
 if not exists(select 1 from jsonb_array_elements(p_payload->'snapshot'->'tables'->'household_members') m where m->>'household_id'=p_source::text and m->>'user_id'=uid::text and m->>'left_at' is null) then raise exception 'SOURCE_MEMBERSHIP_REQUIRED'; end if;
 select exists(select 1 from jsonb_array_elements(p_payload->'snapshot'->'tables'->'household_members') m where m->>'household_id'=p_source::text and m->>'user_id'=uid::text and m->>'role'='OWNER' and m->>'left_at' is null) into source_owner;
 select household_id,(role='OWNER') into target,current_owner from public.household_members where user_id=uid and left_at is null for share;
 if target is null then raise exception 'CURRENT_MEMBERSHIP_REQUIRED'; end if;
 if target<>p_source and not exists(select 1 from backup_private.recovered_households where account_id=uid and source_id=p_source and signature=p_signature and replacement_id=target) then raise exception 'HOUSEHOLD_MISMATCH'; end if;
 for r in select value from jsonb_array_elements(items) loop
  if r->>'household_id' is distinct from p_source::text then raise exception 'INVALID_MEAL_HOUSEHOLD'; end if;
  if r->>'created_by' is distinct from uid::text and not (source_owner and current_owner) then deferred:=deferred+1; continue; end if;
  row_id:=(r->>'id')::uuid;
  select household_id into existing_home from public.meal_plans where id=row_id for share;
  if found then
   if existing_home is distinct from target then raise exception 'BACKUP_ID_CONFLICT'; end if;
   skipped:=skipped+1; continue;
  end if;
  insert into public.meal_plans(id,household_id,created_by,meal_date,meal_type,title,minutes,assignee,ingredients,image_choice,created_at,updated_at)
   select x.id,target,x.created_by,x.meal_date,x.meal_type,x.title,x.minutes,x.assignee,x.ingredients,x.image_choice,x.created_at,x.updated_at
   from jsonb_populate_record(null::public.meal_plans,r) x
   on conflict (household_id,meal_date,meal_type) do nothing;
  get diagnostics n=row_count;
  if n=1 then inserted:=inserted+1; else skipped:=skipped+1; end if;
 end loop;
 return jsonb_build_object('inserted',inserted,'skipped',skipped,'deferred',deferred);
end $$;
revoke all on function public.mobile_restore_signed_meals(jsonb,text,uuid) from public,anon;
grant execute on function public.mobile_restore_signed_meals(jsonb,text,uuid) to authenticated;
