DO $$
BEGIN
  IF to_regclass('public.students') IS NULL AND to_regclass('public.candidates') IS NOT NULL THEN
    ALTER TABLE public.candidates RENAME TO students;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name text NOT NULL,
  candidate_id text NOT NULL,
  current_rank text NOT NULL,
  target_rank text NOT NULL,
  examiner_name text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  join_code text NOT NULL UNIQUE DEFAULT upper(replace(gen_random_uuid()::text, '-', '')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.school_memberships (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
ALTER TABLE public.evaluations ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
ALTER TABLE public.assessment_sessions ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
ALTER TABLE public.session_scores ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);

DO $$
DECLARE
  legacy_school_id uuid;
  has_legacy_records boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.students)
      OR EXISTS (SELECT 1 FROM public.evaluations)
      OR EXISTS (SELECT 1 FROM public.assessment_sessions)
    INTO has_legacy_records;

  IF has_legacy_records THEN
    INSERT INTO public.schools (name)
    VALUES ('Existing school records')
    RETURNING id INTO legacy_school_id;

    UPDATE public.students SET school_id = legacy_school_id WHERE school_id IS NULL;
    UPDATE public.evaluations SET school_id = legacy_school_id WHERE school_id IS NULL;
    UPDATE public.assessment_sessions SET school_id = legacy_school_id WHERE school_id IS NULL;
    UPDATE public.session_scores scores
    SET school_id = sessions.school_id
    FROM public.assessment_sessions sessions
    WHERE scores.session_id = sessions.id AND scores.school_id IS NULL;
  END IF;
END;
$$;

ALTER TABLE public.students ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE public.evaluations ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE public.assessment_sessions ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE public.session_scores ALTER COLUMN school_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS students_school_created_idx ON public.students (school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS evaluations_school_created_idx ON public.evaluations (school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS assessment_sessions_school_code_idx ON public.assessment_sessions (school_id, session_code);
CREATE INDEX IF NOT EXISTS session_scores_school_session_idx ON public.session_scores (school_id, session_id);

CREATE OR REPLACE FUNCTION public.is_school_member(target_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.school_memberships
    WHERE user_id = auth.uid() AND school_id = target_school_id
  );
$$;

CREATE OR REPLACE FUNCTION public.create_school(p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_school_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in before creating a school';
  END IF;
  IF length(trim(coalesce(p_name, ''))) = 0 OR length(trim(p_name)) > 120 THEN
    RAISE EXCEPTION 'Enter a school name of 1 to 120 characters';
  END IF;
  IF EXISTS (SELECT 1 FROM public.school_memberships WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'This account already belongs to a school';
  END IF;

  INSERT INTO public.schools (name) VALUES (trim(p_name)) RETURNING id INTO new_school_id;
  INSERT INTO public.school_memberships (user_id, school_id) VALUES (auth.uid(), new_school_id);
  RETURN new_school_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_school(p_join_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_school_id uuid;
  current_school_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in before joining a school';
  END IF;

  SELECT id INTO target_school_id
  FROM public.schools
  WHERE join_code = upper(trim(coalesce(p_join_code, '')));
  IF target_school_id IS NULL THEN
    RAISE EXCEPTION 'That school join code is not valid';
  END IF;

  SELECT school_id INTO current_school_id
  FROM public.school_memberships
  WHERE user_id = auth.uid();
  IF current_school_id IS NOT NULL AND current_school_id <> target_school_id THEN
    RAISE EXCEPTION 'This account already belongs to another school';
  END IF;

  INSERT INTO public.school_memberships (user_id, school_id)
  VALUES (auth.uid(), target_school_id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN target_school_id;
END;
$$;

REVOKE ALL ON FUNCTION public.is_school_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_school(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_school(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_school_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_school(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_school(text) TO authenticated;

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS schools_select_members ON public.schools;
CREATE POLICY schools_select_members ON public.schools
FOR SELECT TO authenticated USING (public.is_school_member(id));

DROP POLICY IF EXISTS memberships_select_self ON public.school_memberships;
CREATE POLICY memberships_select_self ON public.school_memberships
FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS anon_select_students ON public.students;
DROP POLICY IF EXISTS anon_insert_students ON public.students;
DROP POLICY IF EXISTS anon_update_students ON public.students;
DROP POLICY IF EXISTS anon_delete_students ON public.students;
DROP POLICY IF EXISTS anon_select_candidates ON public.students;
DROP POLICY IF EXISTS anon_insert_candidates ON public.students;
DROP POLICY IF EXISTS anon_update_candidates ON public.students;
DROP POLICY IF EXISTS anon_delete_candidates ON public.students;
DROP POLICY IF EXISTS students_school_access ON public.students;
CREATE POLICY students_school_access ON public.students
FOR ALL TO authenticated
USING (public.is_school_member(school_id))
WITH CHECK (public.is_school_member(school_id));

DROP POLICY IF EXISTS anon_select_evaluations ON public.evaluations;
DROP POLICY IF EXISTS anon_insert_evaluations ON public.evaluations;
DROP POLICY IF EXISTS anon_update_evaluations ON public.evaluations;
DROP POLICY IF EXISTS anon_delete_evaluations ON public.evaluations;
DROP POLICY IF EXISTS evaluations_school_access ON public.evaluations;
CREATE POLICY evaluations_school_access ON public.evaluations
FOR ALL TO authenticated
USING (public.is_school_member(school_id))
WITH CHECK (public.is_school_member(school_id));

DROP POLICY IF EXISTS anon_select_sessions ON public.assessment_sessions;
DROP POLICY IF EXISTS anon_insert_sessions ON public.assessment_sessions;
DROP POLICY IF EXISTS anon_update_sessions ON public.assessment_sessions;
DROP POLICY IF EXISTS anon_delete_sessions ON public.assessment_sessions;
DROP POLICY IF EXISTS sessions_school_access ON public.assessment_sessions;
CREATE POLICY sessions_school_access ON public.assessment_sessions
FOR ALL TO authenticated
USING (public.is_school_member(school_id))
WITH CHECK (public.is_school_member(school_id));

DROP POLICY IF EXISTS anon_select_session_scores ON public.session_scores;
DROP POLICY IF EXISTS anon_insert_session_scores ON public.session_scores;
DROP POLICY IF EXISTS anon_update_session_scores ON public.session_scores;
DROP POLICY IF EXISTS anon_delete_session_scores ON public.session_scores;
DROP POLICY IF EXISTS session_scores_school_access ON public.session_scores;
CREATE POLICY session_scores_school_access ON public.session_scores
FOR ALL TO authenticated
USING (public.is_school_member(school_id))
WITH CHECK (
  public.is_school_member(school_id)
  AND EXISTS (
    SELECT 1 FROM public.assessment_sessions sessions
    WHERE sessions.id = session_scores.session_id
      AND sessions.school_id = session_scores.school_id
  )
);

REVOKE ALL ON public.schools, public.school_memberships,
  public.students, public.evaluations, public.assessment_sessions, public.session_scores
FROM anon;
GRANT SELECT ON public.schools, public.school_memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students, public.evaluations,
  public.assessment_sessions, public.session_scores TO authenticated;

COMMENT ON TABLE public.schools IS 'Schools that own isolated student and grading records.';
COMMENT ON TABLE public.school_memberships IS 'Maps each authenticated staff account to one school.';
COMMENT ON COLUMN public.schools.join_code IS 'Secret code shared by school staff to let additional staff join.';

NOTIFY pgrst, 'reload schema';
