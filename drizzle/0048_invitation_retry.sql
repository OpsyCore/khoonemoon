-- Serialize use of a one-time invitation. A retry by the same user succeeds
-- only while their original membership remains active; leaving is never undone.
create or replace function public.join_household_with_invitation(p_code_hash text)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  uid uuid := auth.uid();
  invitation public.household_invitations%rowtype;
begin
  if uid is null then raise exception 'UNAUTHORIZED'; end if;
  select * into invitation from public.household_invitations
    where invite_code_hash = p_code_hash for update;
  if invitation.id is null then raise exception 'INVITATION_NOT_FOUND'; end if;
  if invitation.status = 'ACCEPTED' and invitation.accepted_by = uid and exists (
    select 1 from public.household_members where user_id = uid
      and household_id = invitation.household_id and left_at is null
  ) then return invitation.household_id; end if;
  if exists (select 1 from public.household_members where user_id = uid and left_at is null)
    then raise exception 'ALREADY_IN_HOUSEHOLD'; end if;
  if invitation.status <> 'PENDING' then raise exception 'INVITATION_NOT_PENDING'; end if;
  if invitation.expires_at <= now() then raise exception 'INVITATION_EXPIRED'; end if;
  insert into public.household_members(household_id,user_id,role)
    values(invitation.household_id,uid,'MEMBER');
  update public.household_invitations set status='ACCEPTED', accepted_by=uid, accepted_at=now()
    where id=invitation.id;
  return invitation.household_id;
end $$;
revoke all on function public.join_household_with_invitation(text) from public, anon;
grant execute on function public.join_household_with_invitation(text) to authenticated;

-- Retry the same code/hash, without ever storing a bearer code on the server.
create or replace function public.create_household_invitation_retry(p_code_hash text,p_expires_at timestamptz)
returns public.household_invitations language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  uid uuid := auth.uid();
  household uuid;
  invitation public.household_invitations%rowtype;
begin
  if uid is null then raise exception 'UNAUTHORIZED'; end if;
  if p_code_hash is null or p_code_hash !~ '^[0-9a-f]{64}$' or p_expires_at is null then
    raise exception 'INVALID_INVITATION';
  end if;
  select household_id into household from public.household_members
    where user_id=uid and left_at is null and role='OWNER';
  if household is null then raise exception 'ONLY_OWNER_CAN_INVITE'; end if;
  -- Lock on the hash before checking it, to serialize duplicate requests.
  perform pg_advisory_xact_lock(hashtextextended(p_code_hash, 19283));
  select * into invitation from public.household_invitations where invite_code_hash=p_code_hash;
  if invitation.id is not null then
    if invitation.invited_by <> uid or invitation.household_id <> household
       or invitation.expires_at is distinct from p_expires_at then
      raise exception 'INVITATION_RETRY_MISMATCH';
    end if;
    if invitation.status <> 'PENDING' or invitation.expires_at <= now() then
      raise exception 'INVITATION_NOT_PENDING';
    end if;
    return invitation;
  end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '168 hours' then
    raise exception 'INVALID_INVITATION_EXPIRATION';
  end if;
  insert into public.household_invitations(household_id,invited_by,invite_code_hash,expires_at,status)
    values(household,uid,p_code_hash,p_expires_at,'PENDING') returning * into invitation;
  return invitation;
end $$;
revoke all on function public.create_household_invitation_retry(text,timestamptz) from public, anon;
grant execute on function public.create_household_invitation_retry(text,timestamptz) to authenticated;
