-- Legacy web dispatcher claims only an unchanged due reminder whose recipient
-- can still access the target. Application roles cannot claim for another user.
create or replace function backup_private.claim_authorized_reminder(
 p_id uuid,p_user uuid,p_status text,p_updated timestamptz
) returns boolean language plpgsql security definer set search_path=pg_catalog,public,backup_private,pg_temp as $$
declare claimed uuid;
begin
 if p_user is null or p_id is null or p_updated is null or p_status not in ('PENDING','SNOOZED') then return false; end if;
 update public.reminders r set status='SENT',delivered_at=now()
 where r.id=p_id and r.user_id=p_user and r.status::text=p_status and r.updated_at=p_updated and r.delivered_at is null
   and (case when r.status='SNOOZED' then coalesce(r.snoozed_until,r.remind_at) else r.remind_at end)<=now()
   and backup_private.reminder_target_authorized(r.user_id,r.target_type,r.target_id,r.household_id)
 returning r.id into claimed;
 return claimed is not null;
end $$;
revoke all on function backup_private.claim_authorized_reminder(uuid,uuid,text,timestamptz) from public,anon,authenticated,service_role;

create or replace function public.claim_own_authorized_reminder(p_id uuid,p_status text,p_updated timestamptz)
returns boolean language sql security definer set search_path=pg_catalog,public,backup_private,pg_temp as $$
 select backup_private.claim_authorized_reminder(p_id,auth.uid(),p_status,p_updated);
$$;
revoke all on function public.claim_own_authorized_reminder(uuid,text,timestamptz) from public,anon;
grant execute on function public.claim_own_authorized_reminder(uuid,text,timestamptz) to authenticated;

create or replace function public.claim_service_authorized_reminder(p_id uuid,p_user uuid,p_status text,p_updated timestamptz)
returns boolean language sql security definer set search_path=pg_catalog,public,backup_private,pg_temp as $$
 select backup_private.claim_authorized_reminder(p_id,p_user,p_status,p_updated);
$$;
revoke all on function public.claim_service_authorized_reminder(uuid,uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.claim_service_authorized_reminder(uuid,uuid,text,timestamptz) to service_role;
