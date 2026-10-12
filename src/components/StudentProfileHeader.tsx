import { User, IdCard, Award, TrendingUp, ClipboardCheck, Calendar, Plus, X, Users } from 'lucide-react';
import { GRADES, gradeKeyFor, nextStudentGrade, resolveStudentGrade, STUDENT_GRADES } from '@/data/rubrics';
import { isUnder16, type Student } from '@/lib/supabase';

export type ExaminerEntry = {
  id: string;
  name: string;
};

export type ProfileData = {
  studentName: string;
  candidateId: string;
  currentGrade: string;
  targetGrade: string;
  examiners: ExaminerEntry[];
  date: string;
};

type Props = {
  data: ProfileData;
  student?: Student | null;
  onChange: (data: ProfileData) => void;
};

const dash = (value: string | null | undefined) => value || '—';

function StudentRecordCard({ student }: { student: Student }) {
  const today = new Date().toISOString().split('T')[0];
  const expired = !!student.membership_expiry && student.membership_expiry < today;
  const under16 = isUnder16(student.date_of_birth);
  const items: { label: string; value: string; alert?: boolean }[] = [
    { label: 'Email', value: dash(student.email) },
    { label: 'Phone', value: dash(student.phone) },
    { label: 'Date of birth', value: dash(student.date_of_birth) },
    { label: "Guardian's name", value: dash(student.guardian_name) },
    { label: "Guardian's email", value: dash(student.guardian_email) },
    { label: 'Date of last grading', value: dash(student.last_grading_date) },
    { label: 'BT membership number', value: dash(student.bt_membership_number) },
    {
      label: 'Membership expiry',
      value: student.membership_expiry ? `${student.membership_expiry}${expired ? ' (expired)' : ''}` : '—',
      alert: expired,
    },
    { label: 'Belt size', value: dash(student.belt_size) },
  ];
  return (
    <div className="mb-5 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-bold text-slate-900">{student.student_name}</h3>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
          {resolveStudentGrade(student.current_rank) ?? student.current_rank}
        </span>
        {under16 && (
          <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-800">Under 16</span>
        )}
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</dt>
            <dd className={`mt-0.5 break-words text-sm ${item.alert ? 'font-semibold text-red-600' : 'text-slate-900'}`}>
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none placeholder:text-slate-400';
const labelClass = 'flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1.5';

function makeExaminerId() {
  return `ex-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function StudentProfileHeader({ data, student = null, onChange }: Props) {
  const currentGradeInfo = GRADES.find((r) => r.key === gradeKeyFor(data.currentGrade));
  const isTopGrade = data.currentGrade === STUDENT_GRADES[STUDENT_GRADES.length - 1].label;

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
          <h2 className="text-lg font-bold text-slate-900">Student Profile</h2>
          <p className="text-sm text-slate-500">
            {student ? 'Details from the student record' : 'Select a student from the Students tab, or enter details below'}
          </p>
        </div>
      </div>

      {student && <StudentRecordCard student={student} />}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {!student && (
        <>
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
            <IdCard size={14} /> Student ID
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
            onChange={(e) =>
              onChange({ ...data, currentGrade: e.target.value, targetGrade: nextStudentGrade(e.target.value) })
            }
          >
            {!STUDENT_GRADES.some((r) => r.label === data.currentGrade) && (
              <option value={data.currentGrade}>{data.currentGrade}</option>
            )}
            {STUDENT_GRADES.map((r) => (
              <option key={r.label} value={r.label}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        </>
        )}

        <div>
          <label className={labelClass}>
            <TrendingUp size={14} /> Target Grade
          </label>
          <input
            type="text"
            readOnly
            className={`${inputClass} bg-slate-50 text-slate-600`}
            value={isTopGrade ? 'Highest grade' : data.targetGrade}
            title="Set automatically to the next grade in the sequence"
          />
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
            Training Band
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
