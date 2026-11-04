-- Cover foreign keys on active application tables to avoid sequential scans
-- when referenced rows are updated or deleted. Some optional/system tables only
-- exist in the deployed Supabase schema, so guard them for clean local databases.
DO $$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT *
    FROM (VALUES
      ('public', 'chore_completions', 'completed_by', 'chore_completions_completed_by_idx'),
      ('public', 'chores', 'created_by', 'chores_created_by_idx'),
      ('public', 'document_attachments', 'created_by', 'document_attachments_created_by_idx'),
      ('public', 'events', 'creator_id', 'events_creator_id_idx'),
      ('public', 'financial_records', 'created_by', 'financial_records_created_by_idx'),
      ('public', 'financial_records', 'paid_by', 'financial_records_paid_by_idx'),
      ('public', 'household_invitations', 'accepted_by', 'household_invitations_accepted_by_idx'),
      ('public', 'household_invitations', 'invited_by', 'household_invitations_invited_by_idx'),
      ('public', 'households', 'created_by', 'households_created_by_idx'),
      ('public', 'reminder_devices', 'user_id', 'reminder_devices_user_id_idx'),
      ('public', 'reminders', 'household_id', 'reminders_household_id_idx'),
      ('public', 'shopping_items', 'added_by', 'shopping_items_added_by_idx'),
      ('public', 'shopping_items', 'purchased_by', 'shopping_items_purchased_by_idx'),
      ('public', 'shopping_lists', 'created_by', 'shopping_lists_created_by_idx'),
      ('public', 'standalone_push_jobs', 'subscription_id', 'standalone_push_jobs_subscription_id_idx'),
      ('public', 'tasks', 'creator_id', 'tasks_creator_id_idx'),
      ('backup_private', 'recovered_households', 'replacement_id', 'recovered_households_replacement_id_idx')
    ) AS indexes(schema_name, table_name, column_name, index_name)
  LOOP
    IF to_regclass(format('%I.%I', item.schema_name, item.table_name)) IS NOT NULL
       AND EXISTS (
         SELECT 1
         FROM information_schema.columns c
         WHERE c.table_schema = item.schema_name
           AND c.table_name = item.table_name
           AND c.column_name = item.column_name
       )
    THEN
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON %I.%I (%I)',
        item.index_name, item.schema_name, item.table_name, item.column_name
      );
    END IF;
  END LOOP;
END
$$;
