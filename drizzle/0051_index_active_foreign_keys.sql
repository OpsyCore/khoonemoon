-- Cover foreign keys on active application tables to avoid sequential scans
-- when referenced rows are updated or deleted.
CREATE INDEX IF NOT EXISTS chore_completions_completed_by_idx ON public.chore_completions (completed_by);
CREATE INDEX IF NOT EXISTS chores_created_by_idx ON public.chores (created_by);
CREATE INDEX IF NOT EXISTS document_attachments_created_by_idx ON public.document_attachments (created_by);
CREATE INDEX IF NOT EXISTS events_creator_id_idx ON public.events (creator_id);
CREATE INDEX IF NOT EXISTS financial_records_created_by_idx ON public.financial_records (created_by);
CREATE INDEX IF NOT EXISTS financial_records_paid_by_idx ON public.financial_records (paid_by);
CREATE INDEX IF NOT EXISTS household_invitations_accepted_by_idx ON public.household_invitations (accepted_by);
CREATE INDEX IF NOT EXISTS household_invitations_invited_by_idx ON public.household_invitations (invited_by);
CREATE INDEX IF NOT EXISTS households_created_by_idx ON public.households (created_by);
CREATE INDEX IF NOT EXISTS reminder_devices_user_id_idx ON public.reminder_devices (user_id);
CREATE INDEX IF NOT EXISTS reminders_household_id_idx ON public.reminders (household_id);
CREATE INDEX IF NOT EXISTS shopping_items_added_by_idx ON public.shopping_items (added_by);
CREATE INDEX IF NOT EXISTS shopping_items_purchased_by_idx ON public.shopping_items (purchased_by);
CREATE INDEX IF NOT EXISTS shopping_lists_created_by_idx ON public.shopping_lists (created_by);
CREATE INDEX IF NOT EXISTS standalone_push_jobs_subscription_id_idx ON public.standalone_push_jobs (subscription_id);
CREATE INDEX IF NOT EXISTS tasks_creator_id_idx ON public.tasks (creator_id);
CREATE INDEX IF NOT EXISTS recovered_households_replacement_id_idx ON backup_private.recovered_households (replacement_id);
