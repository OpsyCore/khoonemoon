-- Security hardening: remove anonymous execution from authenticated-only
-- SECURITY DEFINER RPCs while preserving the device-credential endpoint.
-- Trigger functions do not need client EXECUTE grants.
REVOKE EXECUTE ON FUNCTION public.cancel_household_invitation(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.complete_chore(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_household(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_household_invitation(text, timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_can_access_chore(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_can_access_event(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_can_access_shopping_list(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_can_access_task(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_can_manage_task(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_household_member(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_household_owner(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.leave_current_household() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.valid_task_assignee(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.cancel_household_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_chore(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_household(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_household_invitation(text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_can_access_chore(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_can_access_event(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_can_access_shopping_list(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_can_access_task(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_can_manage_task(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_household_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_household_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_current_household() TO authenticated;
GRANT EXECUTE ON FUNCTION public.valid_task_assignee(uuid, uuid) TO authenticated;

-- This is a trigger-only function, not an RPC endpoint.
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM PUBLIC, anon, authenticated;

-- Keep read_reminder_device(uuid,text) callable by anon: it is a deliberate
-- device-credential endpoint and validates a high-entropy per-device secret.
-- Do not remove its anon grant without replacing the reminder device flow.

-- Pin search_path for the remaining linter findings.
ALTER FUNCTION public.set_current_timestamp_updated_at() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.calculate_next_chore_due(timestamptz, public.task_recurrence_frequency, integer, integer[]) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.sync_financial_record_due_status() SET search_path = pg_catalog, public, pg_temp;
