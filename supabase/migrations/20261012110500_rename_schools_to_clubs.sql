ALTER TABLE public.schools RENAME TO clubs;
ALTER TABLE public.school_memberships RENAME TO club_memberships;

ALTER TABLE public.students RENAME COLUMN school_id TO club_id;
ALTER TABLE public.evaluations RENAME COLUMN school_id TO club_id;
ALTER TABLE public.assessment_sessions RENAME COLUMN school_id TO club_id;
ALTER TABLE public.session_scores RENAME COLUMN school_id TO club_id;
ALTER TABLE public.club_memberships RENAME COLUMN school_id TO club_id;

UPDATE public.clubs
SET name = 'Existing club records'
WHERE name = 'Existing school records';

DROP POLICY IF EXISTS schools_select_members ON public.clubs;
DROP POLICY IF EXISTS memberships_select_self ON public.club_memberships;
DROP POLICY IF EXISTS students_school_access ON public.students;
DROP POLICY IF EXISTS evaluations_school_access ON public.evaluations;
DROP POLICY IF EXISTS sessions_school_access ON public.assessment_sessions;
DROP POLICY IF EXISTS session_scores_school_access ON public.session_scores;

CREATE OR REPLACE FUNCTION public.is_club_member(target_club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.club_memberships
    WHERE user_id = auth.uid() AND club_id = target_club_id
  );
$$;

CREATE OR REPLACE FUNCTION public.create_club(p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_club_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in before creating a club';
  END IF;
  IF length(trim(coalesce(p_name, ''))) = 0 OR length(trim(p_name)) > 120 THEN
    RAISE EXCEPTION 'Enter a club name of 1 to 120 characters';
  END IF;
  IF EXISTS (SELECT 1 FROM public.club_memberships WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'This account already belongs to a club';
  END IF;

  INSERT INTO public.clubs (name) VALUES (trim(p_name)) RETURNING id INTO new_club_id;
  INSERT INTO public.club_memberships (user_id, club_id) VALUES (auth.uid(), new_club_id);
  RETURN new_club_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_club(p_join_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_club_id uuid;
  current_club_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in before joining a club';
  END IF;

  SELECT id INTO target_club_id
  FROM public.clubs
  WHERE join_code = upper(trim(coalesce(p_join_code, '')));
  IF target_club_id IS NULL THEN
    RAISE EXCEPTION 'That club join code is not valid';
  END IF;

  SELECT club_id INTO current_club_id
  FROM public.club_memberships
  WHERE user_id = auth.uid();
  IF current_club_id IS NOT NULL AND current_club_id <> target_club_id THEN
    RAISE EXCEPTION 'This account already belongs to another club';
  END IF;

  INSERT INTO public.club_memberships (user_id, club_id)
  VALUES (auth.uid(), target_club_id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN target_club_id;
END;
$$;

DROP FUNCTION public.is_school_member(uuid);
DROP FUNCTION public.create_school(text);
DROP FUNCTION public.join_school(text);

REVOKE ALL ON FUNCTION public.is_club_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_club(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_club(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_club_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_club(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_club(text) TO authenticated;

DROP POLICY IF EXISTS clubs_select_members ON public.clubs;
CREATE POLICY clubs_select_members ON public.clubs
FOR SELECT TO authenticated USING (public.is_club_member(id));

DROP POLICY IF EXISTS club_memberships_select_self ON public.club_memberships;
CREATE POLICY club_memberships_select_self ON public.club_memberships
FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY students_club_access ON public.students
FOR ALL TO authenticated
USING (public.is_club_member(club_id))
WITH CHECK (public.is_club_member(club_id));

CREATE POLICY evaluations_club_access ON public.evaluations
FOR ALL TO authenticated
USING (public.is_club_member(club_id))
WITH CHECK (public.is_club_member(club_id));

CREATE POLICY sessions_club_access ON public.assessment_sessions
FOR ALL TO authenticated
USING (public.is_club_member(club_id))
WITH CHECK (public.is_club_member(club_id));

CREATE POLICY session_scores_club_access ON public.session_scores
FOR ALL TO authenticated
USING (public.is_club_member(club_id))
WITH CHECK (
  public.is_club_member(club_id)
  AND EXISTS (
    SELECT 1 FROM public.assessment_sessions sessions
    WHERE sessions.id = session_scores.session_id
      AND sessions.club_id = session_scores.club_id
  )
);

ALTER INDEX IF EXISTS public.students_school_created_idx RENAME TO students_club_created_idx;
ALTER INDEX IF EXISTS public.evaluations_school_created_idx RENAME TO evaluations_club_created_idx;
ALTER INDEX IF EXISTS public.assessment_sessions_school_code_idx RENAME TO assessment_sessions_club_code_idx;
ALTER INDEX IF EXISTS public.session_scores_school_session_idx RENAME TO session_scores_club_session_idx;

COMMENT ON TABLE public.clubs IS 'Clubs that own isolated student and grading records.';
COMMENT ON TABLE public.club_memberships IS 'Maps each authenticated staff account to one club.';
COMMENT ON COLUMN public.clubs.join_code IS 'Secret code shared by club staff to let additional staff join.';

NOTIFY pgrst, 'reload schema';
