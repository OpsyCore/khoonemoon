-- Raise the transaction row ceiling while retaining the independent 4 MiB body
-- limit, RLS and all of 0035's fail-closed checks. Verify the exact prior code
-- rather than silently changing an unexpected function implementation.
do $$
declare source text;
begin
  select pg_get_functiondef('public.mobile_restore_missing(jsonb)'::regprocedure) into source;
  if position('if total>500 then' in source)=0 then raise exception 'unexpected restore function'; end if;
  execute replace(source,'if total>500 then','if total>50000 then');
end $$;
