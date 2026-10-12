DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'session_plans' AND column_name = 'location') THEN
    ALTER TABLE public.session_plans RENAME COLUMN location TO venue;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'session_plans' AND column_name = 'focus') THEN
    ALTER TABLE public.session_plans RENAME COLUMN focus TO session_goals;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'session_plans' AND column_name = 'notes') THEN
    ALTER TABLE public.session_plans RENAME COLUMN notes TO planning_summary;
  END IF;
END $$;

ALTER TABLE public.session_plans
  DROP COLUMN IF EXISTS duration_minutes,
  ADD COLUMN IF NOT EXISTS student_count integer CHECK (student_count IS NULL OR student_count >= 0),
  ADD COLUMN IF NOT EXISTS age_range text,
  ADD COLUMN IF NOT EXISTS group_ability text,
  ADD COLUMN IF NOT EXISTS group_ability_other text,
  ADD COLUMN IF NOT EXISTS medical_information text,
  ADD COLUMN IF NOT EXISTS facility_requirements text,
  ADD COLUMN IF NOT EXISTS human_resources text,
  ADD COLUMN IF NOT EXISTS health_safety text,
  ADD COLUMN IF NOT EXISTS previous_action_points text NOT NULL DEFAULT 'Not applicable to this session',
  ADD COLUMN IF NOT EXISTS mentor text,
  ADD COLUMN IF NOT EXISTS adaptations text,
  ADD COLUMN IF NOT EXISTS warm_up_timing text,
  ADD COLUMN IF NOT EXISTS warm_up text,
  ADD COLUMN IF NOT EXISTS main_timing text,
  ADD COLUMN IF NOT EXISTS main_content text,
  ADD COLUMN IF NOT EXISTS coaching_points text,
  ADD COLUMN IF NOT EXISTS cool_down_timing text,
  ADD COLUMN IF NOT EXISTS cool_down text,
  ADD COLUMN IF NOT EXISTS session_summary text,
  ADD COLUMN IF NOT EXISTS injuries_reported text;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'session_plans' AND column_name = 'start_time') THEN
    ALTER TABLE public.session_plans RENAME COLUMN start_time TO session_time;
  END IF;
END $$;
