-- Create an isolated replacement household from an authenticated backup. Never
-- reuse the old UUID: Storage policies are scoped by that UUID and old objects
-- can outlive deleted household metadata. Never reactivate other members.
create table if not exists backup_private.recovered_households (
 account_id uuid not null, source_id uuid not null, signature text not null,
 replacement_id uuid not null references public.households(id) on delete cascade,
 primary key(account_id,source_id,signature)
);
revoke all on backup_private.recovered_households from public,anon,authenticated,khoonemoon_backup_signer;

create or replace function public.mobile_recover_household_copy(p_payload jsonb,p_signature text,p_source uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,public,backup_private as $$
declare uid uuid:=auth.uid(); source_row jsonb; replacement uuid; current_home uuid; member_id uuid;
begin
 if uid is null or p_source is null or not public.mobile_verify_snapshot_signature(p_payload,p_signature) then raise exception 'INVALID_BACKUP_SIGNATURE'; end if;
 -- Serialize creation/retry with the same account, including concurrent requests.
 perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
 select household_id into current_home from public.household_members where user_id=uid and left_at is null for update;
 select replacement_id into replacement from backup_private.recovered_households where account_id=uid and source_id=p_source and signature=p_signature;
 if replacement is not null then
   if current_home is distinct from replacement or not public.is_household_owner(replacement) then raise exception 'RECOVERY_HOUSEHOLD_NOT_ACTIVE'; end if;
   return replacement;
 end if;
 if current_home is not null then raise exception 'ALREADY_IN_HOUSEHOLD'; end if;
 select value into source_row from jsonb_array_elements(p_payload->'snapshot'->'tables'->'households') where value->>'id'=p_source::text;
 if source_row is null or not exists (select 1 from jsonb_array_elements(p_payload->'snapshot'->'tables'->'household_members') m where m->>'household_id'=p_source::text and m->>'user_id'=uid::text and m->>'role'='OWNER' and m->>'left_at' is null) then raise exception 'BACKUP_OWNER_REQUIRED'; end if;
 insert into public.households(name,created_by) values (source_row->>'name',uid) returning id into replacement;
 insert into public.household_members(household_id,user_id,role) values (replacement,uid,'OWNER') returning id into member_id;
 insert into backup_private.recovered_households(account_id,source_id,signature,replacement_id) values (uid,p_source,p_signature,replacement);
 return replacement;
end $$;
revoke all on function public.mobile_recover_household_copy(jsonb,text,uuid) from public,anon;
grant execute on function public.mobile_recover_household_copy(jsonb,text,uuid) to authenticated;
