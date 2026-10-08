import { Zap, Grid3x3, Swords, Target, ChevronDown, Info, User2 } from 'lucide-react';
import { useState } from 'react';
import { scoreColorIndex, type AssessmentModule, type AssessmentItem } from '@/data/rubrics';

const iconMap: Record<string, typeof Zap> = {
  Zap,
  Grid3x3,
  Swords,
  Target,
};

export type ExaminerRef = {
  id: string;
  name: string;
};

type Props = {
  modules: AssessmentModule[];
  examinerScores: Record<string, Record<string, Record<string, number>>>;
  examiners: ExaminerRef[];
  activeExaminerId: string | null;
  onActiveExaminerChange: (id: string) => void;
  onScoreChange: (examinerId: string, moduleId: string, itemId: string, score: number) => void;
};

const scoreColors = [
  '',
  'bg-red-500 text-white border-red-600',
  'bg-orange-500 text-white border-orange-600',
  'bg-amber-500 text-white border-amber-600',
  'bg-lime-500 text-white border-lime-600',
  'bg-emerald-600 text-white border-emerald-700',
];

const scoreRingColors = [
  '',
  'ring-red-300',
  'ring-orange-300',
  'ring-amber-300',
  'ring-lime-300',
  'ring-emerald-400',
];

export default function AssessmentModules({
  modules,
  examinerScores,
  examiners,
  activeExaminerId,
  onActiveExaminerChange,
  onScoreChange,
}: Props) {
  if (examiners.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-slate-400">
          Add at least one examiner in the Candidate Profile above to begin scoring.
        </p>
      </div>
    );
  }

  const activeId = activeExaminerId ?? examiners[0].id;
  const activeScores = examinerScores[activeId] ?? {};

  return (
    <div className="space-y-4">
      {/* Examiner tabs */}
      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        {examiners.map((ex, idx) => {
          const isActive = (activeExaminerId ?? examiners[0].id) === ex.id;
          const exScores = examinerScores[ex.id] ?? {};
          const scoredCount = modules.reduce(
            (sum, m) => sum + Object.keys(exScores[m.id] ?? {}).length,
            0,
          );
          const totalItems = modules.reduce((sum, m) => sum + m.items.length, 0);
          return (
            <button
              key={ex.id}
              onClick={() => onActiveExaminerChange(ex.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                isActive
                  ? 'bg-gradient-to-r from-amber-500 to-red-600 text-white shadow-md'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {idx + 1}
              </span>
              <span>{ex.name || `Examiner ${idx + 1}`}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {scoredCount}/{totalItems}
              </span>
            </button>
          );
        })}
      </div>

      {/* Module cards */}
      <div className="space-y-5">
        {modules.map((module) => (
          <ModuleCard
            key={module.id}
            module={module}
            moduleScores={activeScores[module.id] ?? {}}
            onScoreChange={(itemId, score) => onScoreChange(activeId, module.id, itemId, score)}
          />
        ))}
      </div>
    </div>
  );
}

function ModuleCard({
  module,
  moduleScores,
  onScoreChange,
}: {
  module: AssessmentModule;
  moduleScores: Record<string, number>;
  onScoreChange: (itemId: string, score: number) => void;
}) {
  const [openItem, setOpenItem] = useState<string | null>(null);
  const Icon = iconMap[module.icon] ?? Zap;
  const scoredCount = Object.keys(moduleScores).length;
  const moduleAvg =
    scoredCount > 0
      ? (Object.values(moduleScores).reduce((a, b) => a + b, 0) / scoredCount).toFixed(1)
      : '—';

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
            <Icon size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white sm:text-base">{module.title}</h3>
            <p className="text-xs text-slate-400">
              {scoredCount}/{module.items.length} items scored
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-400">Avg</span>
          <span className="rounded-lg bg-amber-500 px-2.5 py-1 text-sm font-bold text-white">
            {moduleAvg}/{module.maxScore}
          </span>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {module.items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            maxScore={module.maxScore}
            currentScore={moduleScores[item.id] ?? 0}
            isOpen={openItem === item.id}
            onToggle={() => setOpenItem(openItem === item.id ? null : item.id)}
            onScore={(score) => onScoreChange(item.id, score)}
          />
        ))}
      </div>
    </div>
  );
}

function ItemRow({
  item,
  maxScore,
  currentScore,
  isOpen,
  onToggle,
  onScore,
}: {
  item: AssessmentItem;
  maxScore: number;
  currentScore: number;
  isOpen: boolean;
  onToggle: () => void;
  onScore: (score: number) => void;
}) {
  return (
    <div className="px-4 py-3 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggle}
            className="flex items-center gap-1.5 text-slate-400 transition hover:text-amber-600"
            title="Show rubric criteria"
          >
            <Info size={14} />
          </button>
          <span className="text-sm font-semibold text-slate-800">{item.label}</span>
          {currentScore > 0 && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${scoreColors[scoreColorIndex(currentScore, maxScore)]}`}
            >
              {currentScore}/{maxScore}
            </span>
          )}
        </div>

        <div className="flex gap-1.5">
          {Array.from({ length: maxScore }, (_, i) => i + 1).map((n) => {
            const isSelected = currentScore === n;
            const colorIdx = scoreColorIndex(n, maxScore);
            return (
              <button
                key={n}
                onClick={() => onScore(n)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-bold transition-all ${
                  isSelected
                    ? `${scoreColors[colorIdx]} ring-2 ${scoreRingColors[colorIdx]} scale-110 shadow-md`
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      {isOpen && (
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
          <div className="flex items-center gap-1.5 border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <ChevronDown size={14} /> Rubric Criteria
          </div>
          <div className="divide-y divide-slate-100">
            {item.rubrics.map((r) => (
              <div
                key={r.score}
                className={`flex items-start gap-3 px-3 py-2.5 transition ${
                  currentScore === r.score ? 'bg-amber-50' : ''
                }`}
              >
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                    scoreColors[scoreColorIndex(r.score, maxScore)] || 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {r.score}
                </span>
                <span className="text-sm text-slate-700">{r.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
