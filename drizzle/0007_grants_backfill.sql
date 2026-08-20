-- 0007_grants_backfill.sql
-- Idempotent backfill of table/RPC privileges required by the app.
-- Intentionally NOT granted: TRUNCATE, TRIGGER, REFERENCES to authenticated.
-- Intentionally NOT granted: table DML/SELECT to anon.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update on table public.profiles to authenticated;

grant select, update on table public.households to authenticated;
grant select on table public.household_members to authenticated;
grant select on table public.household_invitations to authenticated;

grant select, insert, update, delete on table public.tasks to authenticated;
grant select, insert, update, delete on table public.events to authenticated;
grant select, insert, update, delete on table public.reminders to authenticated;
grant select, insert, update on table public.notification_preferences to authenticated;

grant select, insert, update, delete on table public.chores to authenticated;
grant select, insert, update, delete on table public.chore_recurrences to authenticated;
grant select, insert, update, delete on table public.chore_rotations to authenticated;
grant select, insert, update, delete on table public.chore_completions to authenticated;

grant execute on function public.create_household(text) to authenticated;
grant execute on function public.create_household_invitation(text, timestamptz) to authenticated;
grant execute on function public.join_household_with_invitation(text) to authenticated;
grant execute on function public.cancel_household_invitation(uuid) to authenticated;
grant execute on function public.leave_current_household() to authenticated;

grant execute on function public.create_chore(
  text,
  text,
  date,
  uuid,
  public.chore_recurrence_frequency,
  integer,
  integer[],
  uuid[]
) to authenticated;

grant execute on function public.complete_chore(
  uuid,
  date,
  uuid
) to authenticated;

grant execute on function public.update_chore(
  uuid,
  text,
  text,
  date,
  uuid,
  public.chore_recurrence_frequency,
  integer,
  integer[],
  uuid[],
  boolean
) to authenticated;
