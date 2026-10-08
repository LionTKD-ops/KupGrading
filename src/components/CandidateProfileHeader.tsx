import { User, IdCard, Award, TrendingUp, ClipboardCheck, Calendar, Plus, X, Users } from 'lucide-react';
import { GRADES, type GradeKey } from '@/data/rubrics';

export type ExaminerEntry = {
  id: string;
  name: string;
};

export type ProfileData = {
  studentName: string;
  candidateId: string;
  currentGrade: GradeKey;
  targetGrade: string;
  examiners: ExaminerEntry[];
  date: string;
};

type Props = {
  data: ProfileData;
  onChange: (data: ProfileData) => void;
};

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none placeholder:text-slate-400';
const labelClass = 'flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1.5';

function makeExaminerId() {
  return `ex-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function CandidateProfileHeader({ data, onChange }: Props) {
  const currentGradeInfo = GRADES.find((r) => r.key === data.currentGrade);
  const targetGradeOptions = GRADES.filter((r) => r.maxScore > (currentGradeInfo?.maxScore ?? 0));

  const validTarget = targetGradeOptions.some((r) => r.key === data.targetGrade)
    ? data.targetGrade
    : (targetGradeOptions[0]?.key ?? data.targetGrade);

  const addExaminer = () => {
    onChange({ ...data, examiners: [...data.examiners, { id: makeExaminerId(), name: '' }] });
  };

  const updateExaminer = (id: string, name: string) => {
    onChange({
      ...data,
      examiners: data.examiners.map((e) => (e.id === id ? { ...e, name } : e)),
    });
  };

  const removeExaminer = (id: string) => {
    onChange({ ...data, examiners: data.examiners.filter((e) => e.id !== id) });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-red-600 text-white shadow-md">
          <ClipboardCheck size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Candidate Profile</h2>
          <p className="text-sm text-slate-500">Enter the candidate and assessment details below</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className={labelClass}>
            <User size={14} /> Student Name
          </label>
          <input
            type="text"
            className={inputClass}
            placeholder="e.g. Jane Doe"
            value={data.studentName}
            onChange={(e) => onChange({ ...data, studentName: e.target.value })}
          />
        </div>

        <div>
          <label className={labelClass}>
            <IdCard size={14} /> Candidate ID
          </label>
          <input
            type="text"
            className={inputClass}
            placeholder="e.g. TKD-2026-001"
            value={data.candidateId}
            onChange={(e) => onChange({ ...data, candidateId: e.target.value })}
          />
        </div>

        <div>
          <label className={labelClass}>
            <Award size={14} /> Current Grade
          </label>
          <select
            className={inputClass}
            value={data.currentGrade}
            onChange={(e) => {
              const newGrade = e.target.value as GradeKey;
              const newInfo = GRADES.find((r) => r.key === newGrade);
              const newTargets = GRADES.filter((r) => r.maxScore > (newInfo?.maxScore ?? 0));
              onChange({
                ...data,
                currentGrade: newGrade,
                targetGrade: newTargets[0]?.key ?? newGrade,
              });
            }}
          >
            {GRADES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label} — {r.band}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>
            <TrendingUp size={14} /> Target Grade
          </label>
          <select
            className={inputClass}
            value={validTarget}
            onChange={(e) => onChange({ ...data, targetGrade: e.target.value })}
          >
            {targetGradeOptions.length === 0 && (
              <option value={data.currentGrade}>— Highest grade —</option>
            )}
            {targetGradeOptions.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label} — {r.band}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-1">
          <label className={labelClass}>
            <Calendar size={14} /> Date
          </label>
          <input
            type="date"
            className={inputClass}
            value={data.date}
            onChange={(e) => onChange({ ...data, date: e.target.value })}
          />
        </div>
      </div>

      {/* Multi-examiner section */}
      <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <Users size={14} /> Examiner Panel
          </label>
          <button
            onClick={addExaminer}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600"
          >
            <Plus size={14} /> Add Examiner
          </button>
        </div>

        {data.examiners.length === 0 ? (
          <p className="py-2 text-center text-sm text-slate-400">
            No examiners added yet. Each examiner scores independently and results are combined.
          </p>
        ) : (
          <div className="space-y-2">
            {data.examiners.map((ex, idx) => (
              <div key={ex.id} className="flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-700 text-xs font-bold text-amber-400">
                  {idx + 1}
                </span>
                <input
                  type="text"
                  className={inputClass}
                  placeholder={`Examiner ${idx + 1} name`}
                  value={ex.name}
                  onChange={(e) => updateExaminer(ex.id, e.target.value)}
                />
                <button
                  onClick={() => removeExaminer(ex.id)}
                  className="rounded-lg p-2 text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                  title="Remove examiner"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {currentGradeInfo && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl bg-gradient-to-r from-slate-50 to-amber-50/50 px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Assessment Band
          </span>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
            {currentGradeInfo.band}
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Scoring
          </span>
          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800">
            Max {currentGradeInfo.maxScore} · Pass {currentGradeInfo.passMark.toFixed(1)}
          </span>
          {data.examiners.length > 0 && (
            <>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Examiners
              </span>
              <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
                {data.examiners.filter((e) => e.name.trim()).length} active
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
