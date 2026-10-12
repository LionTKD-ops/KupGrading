-- Families can share one email address, and a guardian email can be recorded instead.
DROP INDEX IF EXISTS public.students_email_key;
CREATE INDEX IF NOT EXISTS students_email_idx ON public.students (lower(email));

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS guardian_email text;

NOTIFY pgrst, 'reload schema';
