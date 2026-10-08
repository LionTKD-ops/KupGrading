CREATE TABLE IF NOT EXISTS evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name text NOT NULL,
  candidate_id text NOT NULL,
  current_rank text NOT NULL,
  target_rank text NOT NULL,
  examiner_name text NOT NULL,
  evaluation_date date NOT NULL,
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  average_score numeric DEFAULT 0,
  feedback_tier text,
  training_advice text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_evaluations" ON evaluations;
CREATE POLICY "anon_select_evaluations" ON evaluations FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_evaluations" ON evaluations;
CREATE POLICY "anon_insert_evaluations" ON evaluations FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_evaluations" ON evaluations;
CREATE POLICY "anon_update_evaluations" ON evaluations FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_evaluations" ON evaluations;
CREATE POLICY "anon_delete_evaluations" ON evaluations FOR DELETE
TO anon, authenticated USING (true);