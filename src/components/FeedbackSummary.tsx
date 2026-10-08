import { TrendingUp, MessageSquare, Gauge, Gavel, CheckCircle2, AlertTriangle, XCircle, Users } from 'lucide-react';
import { getFeedbackTier, getVerdict, type AssessmentModule, type GradeKey } from '@/data/rubrics';
import { scoreColorIndex } from '@/data/rubrics';
import type { ExaminerRef } from '@/components/AssessmentModules';

type Props = {
  combinedAverage: number;
  totalItems: number;
  scoredItems: number;
  modules: AssessmentModule[];
  examinerScores: Record<string, Record<string, Record<string, number>>>;
  examiners: ExaminerRef[];
  currentGrade: GradeKey;
  maxScore: number;
  passMark: number;
};

const tierColors: Record<string, string> = {
  Developing: 'from-red-500 to-orange-500',
  Improving: 'from-orange-500 to-amber-500',
  Proficient: 'from-lime-500 to-emerald-500',
  Mastery: 'from-emerald-600 to-teal-600',
};

const tierBg: Record<string, string> = {
  Developing: 'bg-red-50 border-red-200',
  Improving: 'bg-amber-50 border-amber-200',
  Proficient: 'bg-emerald-50 border-emerald-200',
  Mastery: 'bg-teal-50 border-teal-200',
};

const verdictConfig: Record<string, { icon: typeof CheckCircle2; bg: string; text: string; border: string }> = {
  emerald: { icon: CheckCircle2, bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  amber: { icon: AlertTriangle, bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  red: { icon: XCircle, bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
};

export default function FeedbackSummary({
  combinedAverage,
  totalItems,
  scoredItems,
  modules,
  examinerScores,
  examiners,
  currentGrade,
  maxScore,
  passMark,
}: Props) {
  const tier = getFeedbackTier(combinedAverage, maxScore);
  const verdict = getVerdict(combinedAverage, currentGrade);
  const gradient = tierColors[tier.tier] ?? 'from-slate-500 to-slate-700';
  const bg = tierBg[tier.tier] ?? 'bg-slate-50 border-slate-200';
  const progressPct = totalItems > 0 ? (scoredItems / totalItems) * 100 : 0;
  const vCfg = verdictConfig[verdict.color] ?? verdictConfig.amber;
  const VIcon = vCfg.icon;

  // Per-examiner averages
  const examinerAverages = examiners.map((ex) => {
    const exScores = examinerScores[ex.id] ?? {};
    const all: number[] = [];
    for (const m of modules) {
      const ms = exScores[m.id];
      if (ms) {
        for (const item of m.items) {
          if (ms[item.id] !== undefined) all.push(ms[item.id]);
        }
      }
    }
    const avg = all.length > 0 ? all.reduce((a, b) => a + b, 0) / all.length : 0;
    return { id: ex.id, name: ex.name, avg, count: all.length };
  });

  // Per-module combined averages across examiners
  const moduleCombined = modules.map((m) => {
    let sum = 0;
    let count = 0;
    for (const ex of examiners) {
      const ms = (examinerScores[ex.id] ?? {})[m.id] ?? {};
      for (const item of m.items) {
        if (ms[item.id] !== undefined) {
          sum += ms[item.id];
          count++;
        }
      }
    }
    const avg = count > 0 ? sum / count : 0;
    return { id: m.id, title: m.title, avg, count };
  });

  return (
    <div className="space-y-4">
      {/* Verdict banner */}
      {scoredItems > 0 && (
        <div className={`overflow-hidden rounded-2xl border-2 ${vCfg.border} ${vCfg.bg} shadow-sm`}>
          <div className="flex items-center gap-3 px-5 py-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${vCfg.bg} ${vCfg.text}`}>
              <VIcon size={26} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Gavel size={14} className={vCfg.text} />
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Combined Verdict
                </span>
              </div>
              <p className={`text-lg font-extrabold ${vCfg.text}`}>{verdict.label}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{verdict.detail}</p>
            </div>
          </div>
        </div>
      )}

      {/* Combined score gauge */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className={`bg-gradient-to-br ${gradient} px-6 py-5 text-white`}>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/80">
            <Gauge size={16} /> Combined Average Score
          </div>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-5xl font-extrabold tracking-tight">
              {combinedAverage.toFixed(2)}
            </span>
            <span className="mb-1.5 text-xl font-medium text-white/70">/ {maxScore.toFixed(1)}</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur-sm">
              {tier.tier}
            </span>
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur-sm">
              Pass: {passMark.toFixed(1)} / {maxScore}
            </span>
          </div>
        </div>

        <div className="px-6 py-4">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Assessment Progress</span>
            <span>
              {scoredItems} / {totalItems} items scored
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-500`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Per-examiner breakdown */}
      {examiners.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <Users size={16} /> Examiner Scores
          </div>
          <div className="space-y-2.5">
            {examinerAverages.map((ex, idx) => (
              <div key={ex.id}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-medium text-slate-700">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-700 text-xs font-bold text-amber-400">
                      {idx + 1}
                    </span>
                    {ex.name || `Examiner ${idx + 1}`}
                  </span>
                  <span className="font-bold text-slate-900">
                    {ex.count > 0 ? ex.avg.toFixed(2) : '—'}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-slate-600 to-slate-800 transition-all duration-500"
                    style={{ width: `${(ex.avg / maxScore) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Module breakdown */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
          <TrendingUp size={16} /> Combined Module Breakdown
        </div>
        <div className="space-y-2.5">
          {moduleCombined.map((m) => (
            <div key={m.id}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">
                  {m.title.replace(/^Module \d+ — /, '')}
                </span>
                <span className="font-bold text-slate-900">
                  {m.count > 0 ? m.avg.toFixed(1) : '—'}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-red-500 transition-all duration-500"
                  style={{ width: `${(m.avg / 5) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Training advice */}
      <div className={`rounded-2xl border p-5 shadow-sm ${bg}`}>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
          <MessageSquare size={16} /> Combined Training Advice
        </div>
        <p className="text-sm leading-relaxed text-slate-800">{tier.advice}</p>
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <span className="font-semibold">Tier range (normalised to 1–5):</span>
          <span className="rounded bg-white/60 px-2 py-0.5 font-mono font-bold">
            {tier.min.toFixed(1)} – {tier.max.toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
}
