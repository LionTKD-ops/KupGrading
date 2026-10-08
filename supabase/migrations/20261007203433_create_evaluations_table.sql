/*
# Create evaluations table (single-tenant, no auth)

1. New Tables
- `evaluations`
  - `id` (uuid, primary key)
  - `student_name` (text, not null) — full name of the candidate being assessed
  - `candidate_id` (text, not null) — unique ID/registration number of the candidate
  - `current_rank` (text, not null) — the candidate's current belt/rank level
  - `target_rank` (text, not null) — the rank the candidate is testing for
  - `examiner_name` (text, not null) — name of the examiner conducting the assessment
  - `evaluation_date` (date, not null) — date the assessment took place
  - `scores` (jsonb, not null default '{}') — per-module per-item scores (1-5)
  - `average_score` (numeric, default 0) — computed average across all scored items
  - `feedback_tier` (text) — which feedback band the average falls into
  - `training_advice` (text) — auto-generated training advice based on average score
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on `evaluations`.
- Allow anon + authenticated full CRUD — this is a single-tenant app with no sign-in,
  so all data is intentionally shared/public.
*/