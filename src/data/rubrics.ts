export type GradeKey =
  | '10-9 KUP'
  | '8-7 KUP'
  | '6-5 KUP'
  | '4-3 KUP'
  | '2-1 KUP'
  | '1-2 DAN'
  | '3-4 DAN';

export type GradeInfo = {
  key: GradeKey;
  label: string;
  band: string;
  maxScore: number;
  passMark: number;
};

export const GRADES: GradeInfo[] = [
  { key: '10-9 KUP', label: '10-9 KUP', band: 'Low Novice',        maxScore: 1, passMark: 0.6 },
  { key: '8-7 KUP',  label: '8-7 KUP',  band: 'High Novice',        maxScore: 1, passMark: 0.6 },
  { key: '6-5 KUP',  label: '6-5 KUP',  band: 'Low Intermediate',   maxScore: 2, passMark: 1.2 },
  { key: '4-3 KUP',  label: '4-3 KUP',  band: 'High Intermediate',  maxScore: 3, passMark: 1.8 },
  { key: '2-1 KUP',  label: '2-1 KUP',  band: 'Low Advanced',       maxScore: 3, passMark: 1.8 },
  { key: '1-2 DAN',  label: '1-2 DAN',  band: 'Advanced',           maxScore: 4, passMark: 2.4 },
  { key: '3-4 DAN',  label: '3-4 DAN',  band: 'High Advanced',      maxScore: 5, passMark: 3.0 },
];

// Backwards-compatible alias — old import names still resolve
export type RankKey = GradeKey;
export type RankInfo = GradeInfo;
export const RANKS = GRADES;

export type RubricCriterion = {
  score: number;
  description: string;
};

export type AssessmentItem = {
  id: string;
  label: string;
  rubrics: RubricCriterion[];
};

export type AssessmentModule = {
  id: string;
  title: string;
  icon: string;
  maxScore: number;
  items: AssessmentItem[];
};

// Score descriptions keyed by maxScore band. Each score is relative to the
// band's maximum — the top score always describes meeting the standard for
// that level, and lower scores describe varying degrees of not-yet-competent.
const scoreLabels: Record<number, Record<number, string>> = {
  1: {
    1: 'Performs with guidance — demonstrates basic awareness and execution',
  },
  2: {
    1: 'Aware of technique but needs constant prompting',
    2: 'Consistent execution — meets the intermediate-low standard',
  },
  3: {
    1: 'Knows the form but execution is rough and inconsistent',
    2: 'Developing fluency — some errors remain',
    3: 'Fluent execution — meets the intermediate-high standard with minor errors',
  },
  4: {
    1: 'Aware of technique but lacks fluency and application',
    2: 'Developing mastery — some gaps in application',
    3: 'Competent — meets dan-level standard with occasional errors',
    4: 'High-level mastery — consistent and refined performance',
  },
  5: {
    1: 'Aware but execution below high-advanced expectation',
    2: 'Competent but not yet at high-advanced standard',
    3: 'Meets high-advanced standard — solid all-round',
    4: 'Exemplary — consistent high-level performance',
    5: 'Mastery — coaching / demonstration standard',
  },
};

function rubricsFor(maxScore: number): RubricCriterion[] {
  const labels = scoreLabels[maxScore] ?? scoreLabels[1];
  const scores = Array.from({ length: maxScore }, (_, i) => i + 1);
  return scores.map((score) => ({
    score,
    description: labels[score] ?? '',
  }));
}

// Build modules with rubrics keyed to the grade band's max score
export function buildModules(maxScore: number): AssessmentModule[] {
  const r = rubricsFor(maxScore);

  const mk = (id: string, label: string): AssessmentItem => ({ id, label, rubrics: r });

  const modules: Omit<AssessmentModule, 'maxScore'>[] = [
    {
      id: 'basics',
      title: 'Module 1 — Basics',
      icon: 'Zap',
      items: [
        mk('stances', 'Stances'),
        mk('blocks', 'Blocks'),
        mk('strikes', 'Strikes'),
        mk('kicks', 'Kicks'),
      ],
    },
    {
      id: 'poomsae',
      title: 'Module 2 — Poomsae / Forms',
      icon: 'Grid3x3',
      items: [
        mk('pattern-execution', 'Pattern Execution'),
        mk('accuracy-posture', 'Accuracy & Posture'),
      ],
    },
    {
      id: 'sport-applied',
      title: 'Module 3 — Sport & Applied',
      icon: 'Swords',
      items: [
        mk('sparring', 'Sparring'),
        mk('one-one-kicking', '1-1 Kicking'),
        mk('targets', 'Targets'),
        mk('one-step', '1-Step'),
        mk('self-defence', 'Self Defence'),
      ],
    },
    {
      id: 'tactical-drills',
      title: 'Module 4 — Tactical & Drills',
      icon: 'Target',
      items: [
        mk('static-kicks', 'Static Kicks'),
        mk('moving-opponent-kicks', 'Moving Opponent Kicks'),
        mk('multikick', 'Multikick'),
        mk('timing', 'Timing'),
        mk('distance', 'Distance'),
        mk('reaction', 'Reaction'),
        mk('setups', 'Setups'),
        mk('free-sparring', 'Free Sparring'),
      ],
    },
  ];

  return modules.map((m) => ({ ...m, maxScore }));
}

export type FeedbackTier = {
  min: number;
  max: number;
  tier: string;
  advice: string;
};

export const FEEDBACK_TIERS: FeedbackTier[] = [
  {
    min: 1.0,
    max: 1.9,
    tier: 'Developing',
    advice:
      'Step-by-step guidance required; mechanical execution; conscious thought; frequent errors.',
  },
  {
    min: 2.0,
    max: 2.9,
    tier: 'Improving',
    advice:
      'Skills acquired more rapidly; less step-by-step guidance; fewer errors; physical limit bounds.',
  },
  {
    min: 3.0,
    max: 3.9,
    tier: 'Proficient',
    advice:
      'Techniques performed fluently; automatic reflexes & muscle memory; strong power & accuracy.',
  },
  {
    min: 4.0,
    max: 5.0,
    tier: 'Mastery',
    advice:
      'Self-sufficient mastery; consistent high-level performance; grading/competition standard.',
  },
];

// Normalize the average to a 1–5 scale so tiers are comparable across bands
export function getFeedbackTier(avg: number, maxScore: number = 5): FeedbackTier {
  const normalized = maxScore > 0 ? (avg / maxScore) * 5 : avg;
  return (
    FEEDBACK_TIERS.find((t) => normalized >= t.min && normalized <= t.max) ?? FEEDBACK_TIERS[0]
  );
}

export type Verdict = {
  label: string;
  passed: boolean;
  color: string;
  detail: string;
};

// Compare the combined average against the grade band's pass mark (60% of max)
export function getVerdict(average: number, currentGrade: GradeKey): Verdict {
  const gradeInfo = GRADES.find((r) => r.key === currentGrade);
  const maxScore = gradeInfo?.maxScore ?? 1;
  const passMark = gradeInfo?.passMark ?? maxScore * 0.6;
  const conditionalMark = maxScore * 0.5;

  if (average >= passMark) {
    return {
      label: 'PASS',
      passed: true,
      color: 'emerald',
      detail: `Combined average of ${average.toFixed(2)} meets or exceeds the pass mark of ${passMark.toFixed(1)} (60% of max ${maxScore}) for ${currentGrade} (${gradeInfo?.band}). The candidate has demonstrated competence at the required standard.`,
    };
  }
  if (average >= conditionalMark) {
    return {
      label: 'CONDITIONAL',
      passed: false,
      color: 'amber',
      detail: `Combined average of ${average.toFixed(2)} is below the pass mark of ${passMark.toFixed(1)} but above the conditional threshold of ${conditionalMark.toFixed(1)} (50% of max ${maxScore}) for ${currentGrade} (${gradeInfo?.band}). The candidate may pass with remedial training in identified weak areas.`,
    };
  }
  return {
    label: 'NOT YET COMPETENT',
    passed: false,
    color: 'red',
    detail: `Combined average of ${average.toFixed(2)} is below the conditional threshold of ${conditionalMark.toFixed(1)} (50% of max ${maxScore}) for ${currentGrade} (${gradeInfo?.band}). The candidate requires further training before reassessment.`,
  };
}

// Map a raw score to a 1–5 color index so colors are relative to the band's max
export function scoreColorIndex(score: number, maxScore: number): number {
  if (maxScore <= 0) return 1;
  return Math.max(1, Math.min(5, Math.round((score / maxScore) * 5)));
}
