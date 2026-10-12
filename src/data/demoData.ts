import type { ProfileData } from '@/components/StudentProfileHeader';
import type { Student, Evaluation, ExaminerScores } from '@/lib/supabase';

const demoExaminerId = 'demo-examiner';
const demoScores: ExaminerScores = {
  [demoExaminerId]: {
    basics: { stances: 3, blocks: 3, strikes: 2, kicks: 3 },
    patterns: { 'pattern-execution': 3, 'accuracy-posture': 2 },
    'sport-applied': {
      sparring: 2,
      'one-one-kicking': 3,
      targets: 2,
      'one-step': 3,
      'self-defence': 2,
    },
  },
};

const demoDate = '2026-10-12';

export const demoProfile: ProfileData = {
  studentName: 'Alex Morgan',
  candidateId: 'DEMO-001',
  currentGrade: '4-3 KUP',
  targetGrade: '2-1 KUP',
  examiners: [{ id: demoExaminerId, name: 'Master Lee' }],
  date: demoDate,
};

export const demoExaminerScores = demoScores;

export const demoStudents: Student[] = [
  {
    id: 'demo-candidate-1',
    club_id: 'demo-club',
    student_name: 'Alex Morgan',
    candidate_id: 'DEMO-001',
    current_rank: '4-3 KUP',
    target_rank: '2-1 KUP',
    examiner_name: 'Master Lee',
    notes: 'Sample student for preview',
    created_at: `${demoDate}T09:00:00.000Z`,
  },
  {
    id: 'demo-candidate-2',
    club_id: 'demo-club',
    student_name: 'Jamie Chen',
    candidate_id: 'DEMO-002',
    current_rank: '8-7 KUP',
    target_rank: '6-5 KUP',
    examiner_name: 'Master Patel',
    notes: 'Sample student for preview',
    created_at: `${demoDate}T08:00:00.000Z`,
  },
];

export const demoEvaluations: Evaluation[] = [
  {
    id: 'demo-evaluation-1',
    club_id: 'demo-club',
    student_name: demoProfile.studentName,
    candidate_id: demoProfile.candidateId,
    current_rank: demoProfile.currentGrade,
    target_rank: demoProfile.targetGrade,
    examiner_name: 'Master Lee',
    evaluation_date: demoDate,
    scores: demoScores,
    examiner_names: { [demoExaminerId]: 'Master Lee' },
    average_score: 2.55,
    feedback_tier: 'Mastery',
    training_advice: 'Self-sufficient mastery; consistent high-level performance.',
    verdict: 'PASS',
    created_at: `${demoDate}T09:30:00.000Z`,
  },
];
