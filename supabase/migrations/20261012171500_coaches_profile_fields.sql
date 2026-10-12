-- Coaches carry the same membership details as students.
ALTER TABLE public.coaches
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS last_grading_date date,
  ADD COLUMN IF NOT EXISTS bt_membership_number text,
  ADD COLUMN IF NOT EXISTS membership_expiry date,
  ADD COLUMN IF NOT EXISTS belt_size text;

NOTIFY pgrst, 'reload schema';
