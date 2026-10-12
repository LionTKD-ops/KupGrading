ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS guardian_name text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS last_grading_date date,
  ADD COLUMN IF NOT EXISTS bt_membership_number text,
  ADD COLUMN IF NOT EXISTS membership_expiry date,
  ADD COLUMN IF NOT EXISTS belt_size text;

-- Keep any email that was previously stored in the old student ID column.
UPDATE public.students
SET email = lower(trim(candidate_id))
WHERE email IS NULL AND candidate_id LIKE '%@%';

ALTER TABLE public.students
  DROP COLUMN IF EXISTS candidate_id,
  DROP COLUMN IF EXISTS target_rank,
  DROP COLUMN IF EXISTS examiner_name,
  DROP COLUMN IF EXISTS notes;

UPDATE public.students SET email = lower(trim(email)) WHERE email IS NOT NULL;

-- Email is the student's sign-in identity, so it is unique across the whole system.
CREATE UNIQUE INDEX IF NOT EXISTS students_email_key ON public.students (lower(email)) WHERE email IS NOT NULL;
