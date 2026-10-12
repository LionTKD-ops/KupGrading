CREATE TABLE IF NOT EXISTS public.super_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.super_admins FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid());
$$;

-- Only the owner email can claim super admin, and only with a confirmed email.
CREATE OR REPLACE FUNCTION public.claim_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  SELECT lower(email) INTO v_email
  FROM auth.users
  WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL;
  IF v_email IS DISTINCT FROM 'stoppy@gmail.com' THEN
    RETURN public.is_super_admin();
  END IF;
  INSERT INTO public.super_admins (user_id, email)
  VALUES (auth.uid(), v_email)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_clubs()
RETURNS TABLE (
  id uuid,
  name text,
  join_code text,
  created_at timestamptz,
  member_count bigint,
  student_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  RETURN QUERY
  SELECT c.id, c.name, c.join_code, c.created_at,
    (SELECT count(*) FROM public.club_memberships m WHERE m.club_id = c.id),
    (SELECT count(*) FROM public.students s WHERE s.club_id = c.id)
  FROM public.clubs c
  ORDER BY c.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_club(p_club_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  DELETE FROM public.session_scores WHERE club_id = p_club_id;
  DELETE FROM public.assessment_sessions WHERE club_id = p_club_id;
  DELETE FROM public.evaluations WHERE club_id = p_club_id;
  DELETE FROM public.students WHERE club_id = p_club_id;
  DELETE FROM public.club_memberships WHERE club_id = p_club_id;
  DELETE FROM public.clubs WHERE id = p_club_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reset_join_code(p_club_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code text := upper(replace(gen_random_uuid()::text, '-', ''));
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  UPDATE public.clubs SET join_code = v_code WHERE id = p_club_id;
  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_super_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_clubs() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_club(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_reset_join_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_clubs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_club(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_join_code(uuid) TO authenticated;
