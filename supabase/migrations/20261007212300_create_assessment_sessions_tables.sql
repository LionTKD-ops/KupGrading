/*
# Create assessment_sessions and session_scores tables (single-tenant, no auth)

1. New Tables
- `assessment_sessions`
  - `id` (uuid, primary key)
  - `session_code` (text, unique, not null) — short 6-char code examiners use to join
  - `student_name` (text, not null)
  - `candidate_id` (text, not null)
  - `current_rank` (text, not null)
  - `target_rank` (text, not null)
  - `target_mark` (int, not null)
  - `evaluation_date` (date, not null)
  - `examiner_names` (jsonb, default '{}') — map of examinerId -> name
  - `status` (text, default 'active') — 'active' or 'completed'
  - `created_at` (timestamptz, default now())

- `session_scores`
  - `id` (uuid, primary key)
  - `session_id` (uuid, not null, references assessment_sessions)
  - `examiner_id` (text, not null) — client-generated examiner ID
  - `examiner_name` (text, not null)
  - `module_id` (text, not null)
  - `item_id` (text, not null)
  - `score` (int, not null, 1-5)
  - `updated_at` (timestamptz, default now())
  - UNIQUE constraint on (session_id, examiner_id, module_id, item_id)

2. Security
- Enable RLS on both tables.
- Allow anon + authenticated full CRUD — single-tenant, no sign-in.
- session_scores CASCADE delete when parent session is deleted.
*/

CREATE TABLE IF NOT EXISTS assessment_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code text UNIQUE NOT NULL,
  student_name text NOT NULL,
  candidate_id text NOT NULL,
  current_rank text NOT NULL,
  target_rank text NOT NULL,
  target_mark int NOT NULL,
  evaluation_date date NOT NULL,
  examiner_names jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE assessment_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_sessions" ON assessment_sessions;
CREATE POLICY "anon_select_sessions" ON assessment_sessions FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_sessions" ON assessment_sessions;
CREATE POLICY "anon_insert_sessions" ON assessment_sessions FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_sessions" ON assessment_sessions;
CREATE POLICY "anon_update_sessions" ON assessment_sessions FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_sessions" ON assessment_sessions;
CREATE POLICY "anon_delete_sessions" ON assessment_sessions FOR DELETE
TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS session_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  examiner_id text NOT NULL,
  examiner_name text NOT NULL,
  module_id text NOT NULL,
  item_id text NOT NULL,
  score int NOT NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (session_id, examiner_id, module_id, item_id)
);

ALTER TABLE session_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_session_scores" ON session_scores;
CREATE POLICY "anon_select_session_scores" ON session_scores FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_session_scores" ON session_scores;
CREATE POLICY "anon_insert_session_scores" ON session_scores FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_session_scores" ON session_scores;
CREATE POLICY "anon_update_session_scores" ON session_scores FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_session_scores" ON session_scores;
CREATE POLICY "anon_delete_session_scores" ON session_scores FOR DELETE
TO anon, authenticated USING (true);