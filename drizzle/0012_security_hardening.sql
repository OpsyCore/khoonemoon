-- Security hardening (does not ALTER 0010/0011 tables or policies).
-- 1) Pin search_path on trigger helper that was created without one.
-- 2) REVOKE default PUBLIC execute on SECURITY DEFINER / trigger functions.
-- 3) GRANT execute only to authenticated for client RPCs and RLS helpers.
-- Apply on hosted khoonemoon after 0011. Not applied from this sandbox.

alter function public.set_current_timestamp_updated_at()
  set search_path = public, pg_temp;

revoke all on function public.set_current_timestamp_updated_at() from public;
revoke all on function public.set_current_timestamp_updated_at() from anon;
revoke all on function public.set_current_timestamp_updated_at() from authenticated;

revoke all on function public.handle_new_user_profile() from public;
revoke all on function public.handle_new_user_profile() from anon;
revoke all on function public.handle_new_user_profile() from authenticated;

revoke all on function public.protect_household_immutable_fields() from public;
revoke all on function public.protect_household_immutable_fields() from anon;
revoke all on function public.protect_household_immutable_fields() from authenticated;

revoke all on function public.protect_chore_ownership_fields() from public;
revoke all on function public.protect_chore_ownership_fields() from anon;
revoke all on function public.protect_chore_ownership_fields() from authenticated;

revoke all on function public.set_shopping_updated_at() from public;
revoke all on function public.set_shopping_updated_at() from anon;
revoke all on function public.set_shopping_updated_at() from authenticated;

revoke all on function public.protect_shopping_list_immutable_fields() from public;
revoke all on function public.protect_shopping_list_immutable_fields() from anon;
revoke all on function public.protect_shopping_list_immutable_fields() from authenticated;

revoke all on function public.protect_shopping_item_immutable_fields() from public;
revoke all on function public.protect_shopping_item_immutable_fields() from anon;
revoke all on function public.protect_shopping_item_immutable_fields() from authenticated;

revoke all on function public.protect_finance_record_immutable_fields() from public;
revoke all on function public.protect_finance_record_immutable_fields() from anon;
revoke all on function public.protect_finance_record_immutable_fields() from authenticated;

revoke all on function public.protect_document_immutable_fields() from public;
revoke all on function public.protect_document_immutable_fields() from anon;
revoke all on function public.protect_document_immutable_fields() from authenticated;

-- RLS helpers (must remain executable by authenticated so policies can call them)
revoke all on function public.is_household_member(uuid) from public;
revoke all on function public.is_household_member(uuid) from anon;
grant execute on function public.is_household_member(uuid) to authenticated;

revoke all on function public.is_household_owner(uuid) from public;
revoke all on function public.is_household_owner(uuid) from anon;
grant execute on function public.is_household_owner(uuid) to authenticated;

revoke all on function public.current_user_can_access_task(uuid) from public;
revoke all on function public.current_user_can_access_task(uuid) from anon;
grant execute on function public.current_user_can_access_task(uuid) to authenticated;

revoke all on function public.current_user_can_manage_task(uuid) from public;
revoke all on function public.current_user_can_manage_task(uuid) from anon;
grant execute on function public.current_user_can_manage_task(uuid) to authenticated;

revoke all on function public.valid_task_assignee(uuid, uuid) from public;
revoke all on function public.valid_task_assignee(uuid, uuid) from anon;
grant execute on function public.valid_task_assignee(uuid, uuid) to authenticated;

revoke all on function public.current_user_can_access_event(uuid) from public;
revoke all on function public.current_user_can_access_event(uuid) from anon;
grant execute on function public.current_user_can_access_event(uuid) to authenticated;

revoke all on function public.current_user_can_create_reminder(
  public.reminder_target_type,
  uuid,
  uuid
) from public;
revoke all on function public.current_user_can_create_reminder(
  public.reminder_target_type,
  uuid,
  uuid
) from anon;
grant execute on function public.current_user_can_create_reminder(
  public.reminder_target_type,
  uuid,
  uuid
) to authenticated;

revoke all on function public.current_user_can_access_chore(uuid) from public;
revoke all on function public.current_user_can_access_chore(uuid) from anon;
grant execute on function public.current_user_can_access_chore(uuid) to authenticated;

revoke all on function public.current_user_can_manage_chore(uuid) from public;
revoke all on function public.current_user_can_manage_chore(uuid) from anon;
grant execute on function public.current_user_can_manage_chore(uuid) to authenticated;

revoke all on function public.valid_chore_member(uuid, uuid) from public;
revoke all on function public.valid_chore_member(uuid, uuid) from anon;
grant execute on function public.valid_chore_member(uuid, uuid) to authenticated;

revoke all on function public.valid_chore_default_assignee(uuid, uuid) from public;
revoke all on function public.valid_chore_default_assignee(uuid, uuid) from anon;
grant execute on function public.valid_chore_default_assignee(uuid, uuid) to authenticated;

revoke all on function public.valid_finance_paid_by(
  public.finance_visibility,
  uuid,
  uuid,
  uuid
) from public;
revoke all on function public.valid_finance_paid_by(
  public.finance_visibility,
  uuid,
  uuid,
  uuid
) from anon;
grant execute on function public.valid_finance_paid_by(
  public.finance_visibility,
  uuid,
  uuid,
  uuid
) to authenticated;

revoke all on function public.current_user_can_access_document_entity(
  public.document_entity_type,
  uuid
) from public;
revoke all on function public.current_user_can_access_document_entity(
  public.document_entity_type,
  uuid
) from anon;
grant execute on function public.current_user_can_access_document_entity(
  public.document_entity_type,
  uuid
) to authenticated;

-- Finance access helper is SECURITY DEFINER; policies do not call it.
-- Keep ungranted to authenticated (same as 0010).
revoke all on function public.current_user_can_access_finance_record(uuid) from public;
revoke all on function public.current_user_can_access_finance_record(uuid) from anon;
revoke all on function public.current_user_can_access_finance_record(uuid) from authenticated;

-- Client RPCs: authenticated only (auth.uid() required inside)
revoke all on function public.create_household(text) from public;
revoke all on function public.create_household(text) from anon;
grant execute on function public.create_household(text) to authenticated;

revoke all on function public.create_household_invitation(text, timestamptz) from public;
revoke all on function public.create_household_invitation(text, timestamptz) from anon;
grant execute on function public.create_household_invitation(text, timestamptz) to authenticated;

revoke all on function public.join_household_with_invitation(text) from public;
revoke all on function public.join_household_with_invitation(text) from anon;
grant execute on function public.join_household_with_invitation(text) to authenticated;

revoke all on function public.cancel_household_invitation(uuid) from public;
revoke all on function public.cancel_household_invitation(uuid) from anon;
grant execute on function public.cancel_household_invitation(uuid) to authenticated;

revoke all on function public.leave_current_household() from public;
revoke all on function public.leave_current_household() from anon;
grant execute on function public.leave_current_household() to authenticated;

revoke all on function public.create_chore(
  text, text, date, uuid, public.chore_recurrence_frequency, integer, integer[], uuid[]
) from public;
revoke all on function public.create_chore(
  text, text, date, uuid, public.chore_recurrence_frequency, integer, integer[], uuid[]
) from anon;
grant execute on function public.create_chore(
  text, text, date, uuid, public.chore_recurrence_frequency, integer, integer[], uuid[]
) to authenticated;

revoke all on function public.complete_chore(uuid, date, uuid) from public;
revoke all on function public.complete_chore(uuid, date, uuid) from anon;
grant execute on function public.complete_chore(uuid, date, uuid) to authenticated;

revoke all on function public.update_chore(
  uuid, text, text, date, uuid, public.chore_recurrence_frequency, integer, integer[], uuid[], boolean
) from public;
revoke all on function public.update_chore(
  uuid, text, text, date, uuid, public.chore_recurrence_frequency, integer, integer[], uuid[], boolean
) from anon;
grant execute on function public.update_chore(
  uuid, text, text, date, uuid, public.chore_recurrence_frequency, integer, integer[], uuid[], boolean
) to authenticated;

revoke all on function public.create_finance_record(
  public.finance_record_type, text, numeric, text, public.finance_visibility,
  timestamptz, timestamptz, text, text
) from public;
revoke all on function public.create_finance_record(
  public.finance_record_type, text, numeric, text, public.finance_visibility,
  timestamptz, timestamptz, text, text
) from anon;
grant execute on function public.create_finance_record(
  public.finance_record_type, text, numeric, text, public.finance_visibility,
  timestamptz, timestamptz, text, text
) to authenticated;

revoke all on function public.update_finance_record(
  uuid, text, numeric, text, timestamptz, timestamptz, text, text
) from public;
revoke all on function public.update_finance_record(
  uuid, text, numeric, text, timestamptz, timestamptz, text, text
) from anon;
grant execute on function public.update_finance_record(
  uuid, text, numeric, text, timestamptz, timestamptz, text, text
) to authenticated;

revoke all on function public.set_finance_record_paid(uuid, boolean, uuid) from public;
revoke all on function public.set_finance_record_paid(uuid, boolean, uuid) from anon;
grant execute on function public.set_finance_record_paid(uuid, boolean, uuid) to authenticated;
