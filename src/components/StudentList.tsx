import { Users, ChevronRight, Trash2, Search } from 'lucide-react';
import { useState } from 'react';
import type { Student } from '@/lib/supabase';

type Props = {
  students: Student[];
  loading: boolean;
  onSelect: (student: Student) => void;
  onDelete: (id: string) => void;
};

export default function StudentList({ students, loading, onSelect, onDelete }: Props) {
  const [query, setQuery] = useState('');

  const filtered = students.filter((c) => {
    const q = query.toLowerCase();
    return (
      c.student_name.toLowerCase().includes(q) ||
      c.candidate_id.toLowerCase().includes(q) ||
      c.current_rank.toLowerCase().includes(q)
    );
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
        <Users size={18} className="text-amber-600" />
        <h3 className="text-sm font-bold text-slate-900">Students</h3>
        <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
          {students.length}
        </span>
      </div>

      {students.length > 5 && (
        <div className="px-4 pt-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, ID, or grade..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none placeholder:text-slate-400"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="px-5 py-8 text-center text-sm text-slate-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-slate-400">
          {students.length === 0
            ? 'No students yet. Import from CSV or Google Sheets above.'
            : 'No matches found.'}
        </div>
      ) : (
        <div className="max-h-72 divide-y divide-slate-50 overflow-y-auto">
          {filtered.map((student) => (
            <div
              key={student.id}
              className="group flex cursor-pointer items-center gap-3 px-5 py-3 transition hover:bg-amber-50/50"
              onClick={() => onSelect(student)}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 text-xs font-bold text-slate-600">
                {student.student_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {student.student_name}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {student.candidate_id} · {student.current_rank} → {student.target_rank}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(student.id);
                }}
                className="rounded-lg p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 size={16} />
              </button>
              <ChevronRight
                size={16}
                className="text-slate-300 transition group-hover:text-amber-600"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
