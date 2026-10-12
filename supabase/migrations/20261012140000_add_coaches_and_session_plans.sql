DO $$ BEGIN
  CREATE TYPE public.coach_rank AS ENUM ('lead', 'qualified', 'assistant', 'trainee');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.coaches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  phone text,
  rank public.coach_rank NOT NULL DEFAULT 'trainee',
  dan_grade text,
  qualification_expiry date,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coaches_club_id_idx ON public.coaches (club_id);

CREATE TABLE IF NOT EXISTS public.session_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  title text NOT NULL,
  session_date date NOT NULL,
  start_time time,
  duration_minutes integer NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
  location text,
  focus text,
  notes text,
  coach_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS session_plans_club_date_idx ON public.session_plans (club_id, session_date);

ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_plans ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.coaches, public.session_plans FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coaches, public.session_plans TO authenticated;

DROP POLICY IF EXISTS coaches_club_access ON public.coaches;
CREATE POLICY coaches_club_access ON public.coaches
FOR ALL TO authenticated
USING (public.is_club_member(club_id))
WITH CHECK (public.is_club_member(club_id));

DROP POLICY IF EXISTS session_plans_club_access ON public.session_plans;
CREATE POLICY session_plans_club_access ON public.session_plans
FOR ALL TO authenticated
USING (public.is_club_member(club_id))
WITH CHECK (public.is_club_member(club_id));
