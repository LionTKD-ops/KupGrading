/*
# Add verdict and examiner_names columns to evaluations

1. Modified Tables
- `evaluations`
  - ADD `examiner_names` (jsonb, nullable) — maps examiner IDs to names for multi-examiner support
  - ADD `verdict` (text, nullable) — the combined verdict (PASS / CONDITIONAL / NOT YET COMPETENT)

2. Notes
- The `scores` column already stores per-examiner scores as nested jsonb.
- The `examiner_name` text column is kept for backwards compatibility; new
  inserts store a comma-joined list of examiner names there, while
  `examiner_names` stores the full ID-to-name mapping.
- No security changes — existing RLS policies cover the new columns.
*/

ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS examiner_names jsonb;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS verdict text;