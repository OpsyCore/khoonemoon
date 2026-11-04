-- A missing profile can be inserted with the account's existing authenticated
-- INSERT grant and id=auth.uid() policy. No service role or RLS bypass.
do $$
declare source text; old text := '(''profiles'',''id,full_name,timezone,locale,created_at,updated_at'',''id'',false)'; replacement text := '(''profiles'',''id,full_name,timezone,locale,created_at,updated_at'',''id'',true)';
begin
 select pg_get_functiondef('public.mobile_restore_missing(jsonb)'::regprocedure) into source;
 if position(replacement in source)>0 then return; end if;
 if position(old in source)=0 then raise exception 'unexpected restore function'; end if;
 execute replace(source,old,replacement);
end $$;
