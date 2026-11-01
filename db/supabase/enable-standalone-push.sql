-- Operator-only Supabase setup. Apply migrations 0031, 0045 and 0046 and deploy
-- the standalone-push Edge worker first. This schedules real notifications.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
select cron.schedule('standalone-mozilla-push','* * * * *','select backup_private.enqueue_standalone_push();');
