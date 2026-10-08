import { History, Trash2, ChevronRight, Gavel } from 'lucide-react';
import type { Evaluation } from '@/lib/supabase';

type Props = {
  evaluations: Evaluation[];
  loading: boolean;
  onSelect: (ev: Evaluation) => void;
  onDelete: (id: string) => void;
};

const verdictColors: Record<string, string> = {
  PASS: 'bg-emerald-100 text-emerald-700',
  CONDITIONAL: 'bg-amber-100 text-amber-700',
  'NOT YET COMPETENT': 'bg-red-100 text-red-700',
};

export default function SavedEvaluations({ evaluations, loading, onSelect, onDelete }: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
        <History size={18} className="text-amber-600" />
        <h3 className="text-sm font-bold text-slate-900">Saved Evaluations</h3>
        <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
          {evaluations.length}
        </span>
      </div>

      {loading ? (
        <div className="px-5 py-8 text-center text-sm text-slate-400">Loading...</div>
      ) : evaluations.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-slate-400">
          No saved evaluations yet. Complete an assessment and save it.
        </div>
      ) : (
        <div className="max-h-80 divide-y divide-slate-50 overflow-y-auto">
          {evaluations.map((ev) => (
            <div
              key={ev.id}
              className="group flex cursor-pointer items-center gap-3 px-5 py-3 transition hover:bg-amber-50/50"
              onClick={() => onSelect(ev)}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 text-xs font-bold text-amber-400">
                {Number(ev.average_score).toFixed(1)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {ev.student_name}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {ev.current_rank} → {ev.target_rank} · {ev.evaluation_date}
                </p>
              </div>
              {ev.verdict && (
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                    verdictColors[ev.verdict] ?? 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {ev.verdict}
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(ev.id);
                }}
                className="rounded-lg p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 size={16} />
              </button>
              <ChevronRight size={16} className="text-slate-300 transition group-hover:text-amber-600" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
