-- One Google Calendar connection per club. Refresh tokens are only reachable by the
-- service role (Netlify function); no client role has any access to this table.
CREATE TABLE IF NOT EXISTS public.google_calendar_links (
  club_id uuid PRIMARY KEY REFERENCES public.clubs(id) ON DELETE CASCADE,
  connected_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_email text,
  refresh_token text NOT NULL,
  last_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_calendar_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_calendar_links FROM PUBLIC, anon, authenticated;
