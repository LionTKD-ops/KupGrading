-- Assessment sessions in the session planner, with students selected for them,
-- plus a student portal function that returns a signed-in student's own data.
ALTER TABLE public.session_plans
  ADD COLUMN IF NOT EXISTS session_type text NOT NULL DEFAULT 'class';

ALTER TABLE public.session_plans DROP CONSTRAINT IF EXISTS session_plans_session_type_check;
ALTER TABLE public.session_plans
  ADD CONSTRAINT session_plans_session_type_check CHECK (session_type IN ('class', 'assessment'));

CREATE TABLE IF NOT EXISTS public.session_plan_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  session_plan_id uuid NOT NULL REFERENCES public.session_plans(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_plan_id, student_id)
);

CREATE INDEX IF NOT EXISTS session_plan_students_student_idx ON public.session_plan_students (student_id);

ALTER TABLE public.session_plan_students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Club members manage session plan students" ON public.session_plan_students;
CREATE POLICY "Club members manage session plan students"
  ON public.session_plan_students FOR ALL TO authenticated
  USING (public.is_club_member(club_id))
  WITH CHECK (public.is_club_member(club_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_plan_students TO authenticated;

-- Students sign in with the email (or guardian email) on their student record.
-- The email must be confirmed so nobody can claim another person's record.
CREATE OR REPLACE FUNCTION public.my_student_portal()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  user_email text;
  result jsonb;
BEGIN
  SELECT lower(email) INTO user_email
  FROM auth.users
  WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL;

  IF user_email IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(entry ORDER BY entry->'student'->>'student_name'), '[]'::jsonb)
  INTO result
  FROM (
    SELECT jsonb_build_object(
      'student', jsonb_build_object(
        'id', s.id,
        'student_name', s.student_name,
        'current_rank', s.current_rank
      ),
      'club_name', c.name,
      'assessments', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', p.id,
          'title', p.title,
          'session_date', p.session_date,
          'session_time', p.session_time,
          'venue', p.venue
        ) ORDER BY p.session_date, p.session_time)
        FROM public.session_plan_students ps
        JOIN public.session_plans p ON p.id = ps.session_plan_id
        WHERE ps.student_id = s.id
          AND p.session_type = 'assessment'
          AND p.session_date >= current_date
      ), '[]'::jsonb),
      'evaluations', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', e.id,
          'evaluation_date', e.evaluation_date,
          'current_rank', e.current_rank,
          'target_rank', e.target_rank,
          'average_score', e.average_score,
          'feedback_tier', e.feedback_tier,
          'training_advice', e.training_advice,
          'verdict', e.verdict,
          'scores', e.scores
        ) ORDER BY e.evaluation_date DESC)
        FROM (
          SELECT * FROM public.evaluations ev
          WHERE ev.club_id = s.club_id
            AND lower(ev.student_name) = lower(s.student_name)
          ORDER BY ev.evaluation_date DESC
          LIMIT 3
        ) e
      ), '[]'::jsonb)
    ) AS entry
    FROM public.students s
    JOIN public.clubs c ON c.id = s.club_id
    WHERE lower(s.email) = user_email OR lower(s.guardian_email) = user_email
  ) q;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.my_student_portal() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_student_portal() TO authenticated;

NOTIFY pgrst, 'reload schema';
