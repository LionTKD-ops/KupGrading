ALTER TABLE public.coaches
  ADD COLUMN IF NOT EXISTS bt_level1_aca_date date,
  ADD COLUMN IF NOT EXISTS bt_level2_instructor_date date;
