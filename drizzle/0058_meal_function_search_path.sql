-- Do not allow temporary objects to shadow names in privileged backup functions.
alter function public.mobile_signed_export_snapshot_v2() set search_path=pg_catalog,public,backup_private,pg_temp;
alter function public.mobile_restore_signed_meals(jsonb,text,uuid) set search_path=pg_catalog,public,backup_private,pg_temp;
