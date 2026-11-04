DO $$
DECLARE
  p record;
  new_qual text;
  new_check text;
  statement text;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        coalesce(qual, '') LIKE '%auth.uid()%'
        OR coalesce(with_check, '') LIKE '%auth.uid()%'
      )
  LOOP
    new_qual := CASE WHEN p.qual IS NULL THEN NULL
      ELSE replace(p.qual, 'auth.uid()', '(select auth.uid())') END;
    new_check := CASE WHEN p.with_check IS NULL THEN NULL
      ELSE replace(p.with_check, 'auth.uid()', '(select auth.uid())') END;

    statement := format('ALTER POLICY %I ON %I.%I',
      p.policyname, p.schemaname, p.tablename);

    IF new_qual IS NOT NULL THEN
      statement := statement || format(' USING (%s)', new_qual);
    END IF;
    IF new_check IS NOT NULL THEN
      statement := statement || format(' WITH CHECK (%s)', new_check);
    END IF;

    EXECUTE statement;
  END LOOP;
END
$$;
