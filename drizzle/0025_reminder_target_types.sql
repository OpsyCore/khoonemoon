-- PostgreSQL requires the new enum values to commit before use in a function.
alter type public.reminder_target_type add value if not exists 'CHORE';
alter type public.reminder_target_type add value if not exists 'BILL';
