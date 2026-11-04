-- SECURITY DEFINER functions must not implicitly search pg_temp before trusted
-- schemas. Preserve each function's existing schema list, pin pg_catalog first,
-- and explicitly place pg_temp last.
DO $$
DECLARE
  f record;
  remaining_path text;
  safe_path text;
BEGIN
  FOR f IN
    SELECT
      p.oid,
      setting AS search_path_setting
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL unnest(p.proconfig) AS setting
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND setting LIKE 'search_path=%'
  LOOP
    remaining_path := substring(f.search_path_setting FROM length('search_path=') + 1);
    remaining_path := regexp_replace(
      remaining_path,
      '(^|,\s*)pg_catalog(\s*,|$)',
      '',
      'i'
    );
    remaining_path := regexp_replace(
      remaining_path,
      '(^|,\s*)pg_temp(\s*,|$)',
      '',
      'i'
    );
    remaining_path := btrim(remaining_path, ' ,');

    IF remaining_path = '' THEN
      safe_path := 'pg_catalog, pg_temp';
    ELSE
      safe_path := 'pg_catalog, ' || remaining_path || ', pg_temp';
    END IF;

    EXECUTE format(
      'ALTER FUNCTION %s SET search_path TO %s',
      f.oid::regprocedure,
      safe_path
    );
  END LOOP;
END
$$;
