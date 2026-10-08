/*
# Create candidates table (single-tenant, no auth)

1. New Tables
- `candidates`
  - `id` (uuid, primary key)
  - `student_name` (text, not null) — full name of the candidate
  - `candidate_id` (text, not null) — unique ID/registration number
  - `current_rank` (text, not null) — current belt/rank level
  - `target_rank` (text, not null) — the rank the candidate is testing for
  - `examiner_name` (text) — assigned examiner name (optional at import time)
  - `notes` (text) — any optional notes about the candidate
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on `candidates`.
- Allow anon + authenticated full CRUD — single-tenant app with no sign-in,
  all data is intentionally shared/public.
*/

CREATE TABLE IF NOT EXISTS candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name text NOT NULL,
  candidate_id text NOT NULL,
  current_rank text NOT NULL,
  target_rank text NOT NULL,
  examiner_name text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_candidates" ON candidates;
CREATE POLICY "anon_select_candidates" ON candidates FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_candidates" ON candidates;
CREATE POLICY "anon_insert_candidates" ON candidates FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_candidates" ON candidates;
CREATE POLICY "anon_update_candidates" ON candidates FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_candidates" ON candidates;
CREATE POLICY "anon_delete_candidates" ON candidates FOR DELETE
TO anon, authenticated USING (true);