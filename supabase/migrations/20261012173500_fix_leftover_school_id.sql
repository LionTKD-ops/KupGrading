-- Some databases still carry the pre-rename school_id column next to club_id, and it blocks inserts.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['students', 'evaluations', 'assessment_sessions', 'session_scores'] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'school_id'
    ) THEN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = t AND column_name = 'club_id'
      ) THEN
        EXECUTE format('UPDATE public.%I SET club_id = school_id WHERE club_id IS NULL', t);
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN school_id DROP NOT NULL', t);
      ELSE
        EXECUTE format('ALTER TABLE public.%I RENAME COLUMN school_id TO club_id', t);
      END IF;
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
