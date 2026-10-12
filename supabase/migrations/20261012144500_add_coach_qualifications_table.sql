DO $$ BEGIN
  CREATE TYPE public.coach_qualification AS ENUM ('bt_level1_aca', 'bt_level2_instructor');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.coaches DROP CONSTRAINT IF EXISTS coaches_id_club_id_key;
ALTER TABLE public.coaches ADD CONSTRAINT coaches_id_club_id_key UNIQUE (id, club_id);

CREATE TABLE IF NOT EXISTS public.coach_qualifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  coach_id uuid NOT NULL,
  qualification public.coach_qualification NOT NULL,
  date_achieved date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coach_id, qualification),
  FOREIGN KEY (coach_id, club_id) REFERENCES public.coaches (id, club_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS coach_qualifications_club_idx ON public.coach_qualifications (club_id);

-- Carry over dates from the earlier two-column version, then drop those columns.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'coaches' AND column_name = 'bt_level1_aca_date'
  ) THEN
    INSERT INTO public.coach_qualifications (club_id, coach_id, qualification, date_achieved)
    SELECT club_id, id, 'bt_level1_aca', bt_level1_aca_date FROM public.coaches
    WHERE bt_level1_aca_date IS NOT NULL
    ON CONFLICT DO NOTHING;
    INSERT INTO public.coach_qualifications (club_id, coach_id, qualification, date_achieved)
    SELECT club_id, id, 'bt_level2_instructor', bt_level2_instructor_date FROM public.coaches
    WHERE bt_level2_instructor_date IS NOT NULL
    ON CONFLICT DO NOTHING;
    ALTER TABLE public.coaches
      DROP COLUMN bt_level1_aca_date,
      DROP COLUMN bt_level2_instructor_date;
  END IF;
END $$;

ALTER TABLE public.coach_qualifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coach_qualifications FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_qualifications TO authenticated;

DROP POLICY IF EXISTS coach_qualifications_club_access ON public.coach_qualifications;
CREATE POLICY coach_qualifications_club_access ON public.coach_qualifications
FOR ALL TO authenticated
USING (public.is_club_member(club_id))
WITH CHECK (public.is_club_member(club_id));
