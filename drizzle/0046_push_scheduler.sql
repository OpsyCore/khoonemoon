-- PostgreSQL cron invokes this function; pg_net and pg_cron are provisioned
-- separately by the operator because they are Supabase-managed extensions.
create or replace function backup_private.enqueue_standalone_push()
returns bigint language plpgsql security definer set search_path=pg_catalog,backup_private,net as $$
declare nonce text; request_id bigint;
begin
 delete from backup_private.push_nonces where expires_at<now();
 nonce:=replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
 insert into backup_private.push_nonces(digest,expires_at) values(sha256(convert_to(nonce,'UTF8')),now()+interval '2 minutes');
 select net.http_post(
   url:='https://isfzuxrkzeeeggvfcoah.supabase.co/functions/v1/standalone-push',
   headers:=jsonb_build_object('Content-Type','application/json','x-dispatch-nonce',nonce),
   body:='{}'::jsonb,timeout_milliseconds:=30000
 ) into request_id;
 return request_id;
end $$;
revoke all on function backup_private.enqueue_standalone_push() from public,anon,authenticated;
