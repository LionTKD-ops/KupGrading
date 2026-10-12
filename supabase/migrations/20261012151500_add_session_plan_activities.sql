ALTER TABLE public.session_plans
  ADD COLUMN IF NOT EXISTS series_id uuid,
  DROP COLUMN IF EXISTS warm_up_timing,
  DROP COLUMN IF EXISTS warm_up,
  DROP COLUMN IF EXISTS main_timing,
  DROP COLUMN IF EXISTS main_content,
  DROP COLUMN IF EXISTS coaching_points,
  DROP COLUMN IF EXISTS cool_down_timing,
  DROP COLUMN IF EXISTS cool_down;

CREATE INDEX IF NOT EXISTS session_plans_series_idx ON public.session_plans (club_id, series_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_plans_id_club_key') THEN
    ALTER TABLE public.session_plans ADD CONSTRAINT session_plans_id_club_key UNIQUE (id, club_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.session_plan_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  session_plan_id uuid NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  section text NOT NULL DEFAULT 'Main content' CHECK (section IN ('Warm up', 'Main content', 'Cool down')),
  timing text,
  description text,
  content_activity text,
  coaching_points text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (session_plan_id, club_id) REFERENCES public.session_plans (id, club_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS session_plan_activities_plan_idx ON public.session_plan_activities (session_plan_id, sort_order);

ALTER TABLE public.session_plan_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Club members manage session plan activities" ON public.session_plan_activities;
CREATE POLICY "Club members manage session plan activities"
  ON public.session_plan_activities FOR ALL TO authenticated
  USING (public.is_club_member(club_id))
  WITH CHECK (public.is_club_member(club_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_plan_activities TO authenticated;
