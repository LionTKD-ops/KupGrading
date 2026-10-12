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
  club_id: string;
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

export type Student = {
  id: string;
  club_id: string;
  student_name: string;
  email: string | null;
  phone: string | null;
  guardian_name: string | null;
  date_of_birth: string | null;
  current_rank: string;
  last_grading_date: string | null;
  bt_membership_number: string | null;
  membership_expiry: string | null;
  belt_size: string | null;
  created_at: string;
};

export type StudentInput = Omit<Student, 'id' | 'club_id' | 'created_at'>;

export const BELT_SIZES = ['220', '240', '260', '280', '300', '320', '340'] as const;

export const isUnder16 = (dateOfBirth: string | null, on: Date = new Date()) => {
  if (!dateOfBirth) return false;
  const dob = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return false;
  const sixteenth = new Date(dob.getFullYear() + 16, dob.getMonth(), dob.getDate());
  return on < sixteenth;
};

export type AssessmentSession = {
  id: string;
  club_id: string;
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

export type CoachRank = 'lead' | 'qualified' | 'assistant' | 'trainee';

export const COACH_RANKS: { value: CoachRank; label: string; description: string }[] = [
  { value: 'lead', label: 'Lead coach', description: 'Can run a session and sign off gradings' },
  { value: 'qualified', label: 'Qualified coach', description: 'Qualified to run a session' },
  { value: 'assistant', label: 'Assistant coach', description: 'Supports a qualified or lead coach' },
  { value: 'trainee', label: 'Trainee coach', description: 'In training, supervised at all times' },
];

export const DAN_GRADES = [
  '1st Dan',
  '2nd Dan',
  '3rd Dan',
  '4th Dan',
  '5th Dan (Master)',
  '6th Dan (Master)',
  '7th Dan (Master)',
  '8th Dan (Grandmaster)',
  '9th Dan (Grandmaster)',
] as const;

export type CoachQualificationType = 'bt_level1_aca' | 'bt_level2_instructor';

export const COACH_QUALIFICATIONS: { value: CoachQualificationType; label: string }[] = [
  { value: 'bt_level1_aca', label: 'British Taekwondo Level 1 ACA' },
  { value: 'bt_level2_instructor', label: 'British Taekwondo Level 2 Instructor' },
];

export type CoachQualification = {
  id: string;
  club_id: string;
  coach_id: string;
  qualification: CoachQualificationType;
  date_achieved: string;
  created_at: string;
};

export type Coach = {
  id: string;
  club_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  rank: CoachRank;
  dan_grade: string | null;
  date_of_birth: string | null;
  last_grading_date: string | null;
  bt_membership_number: string | null;
  membership_expiry: string | null;
  belt_size: string | null;
  qualification_expiry: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
};

export const GROUP_ABILITIES = ['Beginners', 'Intermediate', 'Advanced', 'Mixed ability', 'Other'] as const;

export type SessionPlan = {
  id: string;
  club_id: string;
  title: string;
  student_count: number | null;
  age_range: string | null;
  group_ability: string | null;
  group_ability_other: string | null;
  medical_information: string | null;
  planning_summary: string | null;
  session_date: string;
  session_time: string | null;
  venue: string | null;
  facility_requirements: string | null;
  human_resources: string | null;
  coach_ids: string[];
  health_safety: string | null;
  previous_action_points: string;
  mentor: string | null;
  session_goals: string | null;
  adaptations: string | null;
  session_summary: string | null;
  injuries_reported: string | null;
  series_id: string | null;
  created_at: string;
};

export const PLAN_SECTIONS = ['Warm up', 'Main content', 'Cool down'] as const;
export type PlanSection = (typeof PLAN_SECTIONS)[number];

export type SessionPlanActivity = {
  id: string;
  club_id: string;
  session_plan_id: string;
  sort_order: number;
  section: PlanSection;
  timing: string | null;
  description: string | null;
  content_activity: string | null;
  coaching_points: string | null;
};

export type SessionScore = {
  id: string;
  club_id: string;
  session_id: string;
  examiner_id: string;
  examiner_name: string;
  module_id: string;
  item_id: string;
  score: number;
  updated_at: string;
};
