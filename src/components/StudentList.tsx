import { Users, ChevronRight, Trash2, Search, Pencil } from 'lucide-react';
import { useState } from 'react';
import type { Student } from '@/lib/supabase';

type Props = {
  students: Student[];
  loading: boolean;
  onSelect: (student: Student) => void;
  onEdit: (student: Student) => void;
  onDelete: (id: string) => void;
  floorIds: string[];
  onToggleFloor: (id: string) => void;
  onSetFloor: (ids: string[]) => void;
};

const expiryNote = (expiry: string | null) => {
  if (!expiry) return null;
  const expired = expiry < new Date().toISOString().split('T')[0];
  return (
    <p className={`truncate text-xs ${expired ? 'font-semibold text-red-600' : 'text-slate-400'}`}>
      {expired ? 'Membership expired' : 'Membership expires'} {expiry}
    </p>
  );
};

export default function StudentList({ students, loading, onSelect, onEdit, onDelete, floorIds, onToggleFloor, onSetFloor }: Props) {
  const [query, setQuery] = useState('');

  const filtered = students.filter((c) => {
    const q = query.toLowerCase();
    return (
      c.student_name.toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.guardian_email ?? '').toLowerCase().includes(q) ||
      (c.bt_membership_number ?? '').toLowerCase().includes(q) ||
      c.current_rank.toLowerCase().includes(q)
    );
  });

  const allShownOnFloor = filtered.length > 0 && filtered.every((s) => floorIds.includes(s.id));
  const toggleAllShown = () => {
    const shownIds = filtered.map((s) => s.id);
    onSetFloor(
      allShownOnFloor
        ? floorIds.filter((id) => !shownIds.includes(id))
        : [...floorIds, ...shownIds.filter((id) => !floorIds.includes(id))],
    );
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
        <Users size={18} className="text-amber-600" />
        <h3 className="text-sm font-bold text-slate-900">Students</h3>
        {filtered.length > 0 && (
          <button
            onClick={toggleAllShown}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            {allShownOnFloor ? 'Remove all from floor list' : 'Add all to floor list'}
          </button>
        )}
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
              placeholder="Search by name, email, BT number or grade..."
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
            ? 'No students yet. Add a student above or import from CSV or Google Sheets.'
            : 'No matches found.'}
        </div>
      ) : (
        <div className="max-h-[32rem] divide-y divide-slate-50 overflow-y-auto">
          {filtered.map((student) => (
            <div
              key={student.id}
              className="group flex cursor-pointer items-center gap-3 px-5 py-3 transition hover:bg-amber-50/50"
              onClick={() => onSelect(student)}
            >
              <input
                type="checkbox"
                aria-label={`Add ${student.student_name} to floor list`}
                title="Add to floor list"
                className="h-4 w-4 shrink-0 accent-amber-500"
                checked={floorIds.includes(student.id)}
                onClick={(e) => e.stopPropagation()}
                onChange={() => onToggleFloor(student.id)}
              />
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 text-xs font-bold text-slate-600">
                {student.student_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {student.student_name}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {[student.email ?? (student.guardian_email && `Guardian: ${student.guardian_email}`), student.current_rank, student.bt_membership_number && `BT `].filter(Boolean).join(' · ')}
                </p>
                {expiryNote(student.membership_expiry)}
              </div>
              <button
                aria-label={`Edit ${student.student_name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(student);
                }}
                className="rounded-lg p-1.5 text-slate-300 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <Pencil size={16} />
              </button>
              <button
                aria-label={`Delete ${student.student_name}`}
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
