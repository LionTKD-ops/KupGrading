-- Black belts of 4th Dan and above can be approved as Kup grade examiners.
ALTER TABLE public.coaches ADD COLUMN IF NOT EXISTS kup_examiner boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
