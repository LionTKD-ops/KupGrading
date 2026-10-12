import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Per-examiner scores: examinerId -> moduleId -> itemId -> score (1-5)
export type ExaminerScores = Record<string, Record<string, Record<string, number>>>;

export type Evaluation = {
  id: string;
  student_name: string;
  candidate_id: string;
  current_rank: string;
  target_rank: string;
  examiner_name: string;
  evaluation_date: string;
  scores: ExaminerScores;
  examiner_names: Record<string, string> | null;
  average_score: number;
  feedback_tier: string | null;
  training_advice: string | null;
  verdict: string | null;
  created_at: string;
};

export type Candidate = {
  id: string;
  student_name: string;
  candidate_id: string;
  current_rank: string;
  target_rank: string;
  examiner_name: string | null;
  notes: string | null;
  created_at: string;
};

export type AssessmentSession = {
  id: string;
  session_code: string;
  student_name: string;
  candidate_id: string;
  current_rank: string;
  target_rank: string;
  target_mark: number;
  evaluation_date: string;
  examiner_names: Record<string, string>;
  status: string;
  created_at: string;
};

export type SessionScore = {
  id: string;
  session_id: string;
  examiner_id: string;
  examiner_name: string;
  module_id: string;
  item_id: string;
  score: number;
  updated_at: string;
};
