CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
DECLARE
  extension_schema text;
BEGIN
  SELECT n.nspname
  INTO extension_schema
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'pg_trgm';

  IF extension_schema IS NOT NULL AND extension_schema <> 'extensions' THEN
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
  END IF;
END
$$;
