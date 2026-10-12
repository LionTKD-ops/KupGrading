import { ListChecks, Play, X } from 'lucide-react';
import { GRADES, gradeKeyFor } from '@/data/rubrics';
import type { Student } from '@/lib/supabase';

type Props = {
  students: Student[];
  activeId: string | null;
  onOpen: (student: Student) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
};

export default function FloorList({ students, activeId, onOpen, onRemove, onClear }: Props) {
  if (students.length === 0) return null;

  const floors = GRADES.map((grade) => ({
    grade,
    students: students.filter((s) => gradeKeyFor(s.current_rank) === grade.key),
  })).filter((floor) => floor.students.length > 0);

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <ListChecks size={16} className="text-amber-600" />
        <h3 className="text-sm font-bold text-slate-900">Floor lists</h3>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-600">
          {students.length} students · {floors.length} floor{floors.length !== 1 ? 's' : ''}
        </span>
        <button onClick={onClear} className="ml-auto text-xs font-semibold text-slate-500 hover:text-red-600">
          Clear
        </button>
      </div>
      <div className="space-y-3">
        {floors.map((floor, floorIdx) => (
          <div key={floor.grade.key} className="rounded-xl border border-amber-100 bg-white/70 p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-900">
                Floor {floorIdx + 1} · {floor.grade.label}
              </span>
              <span className="text-xs text-slate-500">
                {floor.grade.band} · pass {floor.grade.passMark.toFixed(1)}/{floor.grade.maxScore}
              </span>
              <button
                onClick={() => onOpen(floor.students[0])}
                className="ml-auto flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-600"
              >
                <Play size={12} /> Start floor
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {floor.students.map((student, idx) => (
                <div
                  key={student.id}
                  className={`flex items-center gap-1 rounded-lg border py-1 pl-2.5 pr-1 text-xs ${
                    activeId === student.id
                      ? 'border-amber-500 bg-amber-500 text-white'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <button onClick={() => onOpen(student)} className="text-left font-semibold" title="Open for assessment">
                    {idx + 1}. {student.student_name}
                    <span className={activeId === student.id ? 'ml-1 text-amber-100' : 'ml-1 text-slate-400'}>
                      {student.current_rank}
                    </span>
                  </button>
                  <button
                    aria-label={`Remove ${student.student_name} from floor list`}
                    onClick={() => onRemove(student.id)}
                    className="rounded p-0.5 opacity-60 hover:opacity-100"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
