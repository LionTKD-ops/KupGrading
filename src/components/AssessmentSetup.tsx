import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CalendarPlus, Loader2, Pencil, Trash2, X } from 'lucide-react';
import { GRADES, gradeKeyFor } from '@/data/rubrics';
import { supabase, type Coach, type SessionPlan, type Student } from '@/lib/supabase';
import { autoSyncCalendar } from '@/lib/googleCalendar';

type Props = {
  clubId: string;
};

type Form = {
  title: string;
  session_date: string;
  session_time: string;
  venue: string;
  coach_ids: string[];
  student_ids: string[];
};

const emptyForm: Form = { title: '', session_date: '', session_time: '', venue: '', coach_ids: [], student_ids: [] };

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20';

export default function AssessmentSetup({ clubId }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<Form>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [assessments, setAssessments] = useState<SessionPlan[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [examiners, setExaminers] = useState<Coach[]>([]);
  const [studentIdsByPlan, setStudentIdsByPlan] = useState<Record<string, string[]>>({});

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const [plans, studentRows, coachRows, links] = await Promise.all([
      supabase.from('session_plans').select('*').eq('club_id', clubId).eq('session_type', 'assessment').order('session_date'),
      supabase.from('students').select('*').eq('club_id', clubId).order('student_name'),
      supabase.from('coaches').select('*').eq('club_id', clubId).eq('active', true).eq('kup_examiner', true).order('full_name'),
      supabase.from('session_plan_students').select('session_plan_id, student_id').eq('club_id', clubId),
    ]);
    const loadError = plans.error ?? studentRows.error ?? coachRows.error ?? links.error;
    if (loadError) setError(loadError.message);
    else {
      setAssessments((plans.data ?? []) as SessionPlan[]);
      setStudents((studentRows.data ?? []) as Student[]);
      setExaminers((coachRows.data ?? []) as Coach[]);
      const byPlan: Record<string, string[]> = {};
      (links.data ?? []).forEach((row) => {
        (byPlan[row.session_plan_id as string] ??= []).push(row.student_id as string);
      });
      setStudentIdsByPlan(byPlan);
    }
    setLoading(false);
  }, [clubId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (key: 'coach_ids' | 'student_ids', id: string) =>
    setForm((current) => ({
      ...current,
      [key]: current[key].includes(id) ? current[key].filter((item) => item !== id) : [...current[key], id],
    }));

  const toggleBand = (ids: string[]) =>
    setForm((current) => {
      const allSelected = ids.every((id) => current.student_ids.includes(id));
      return {
        ...current,
        student_ids: allSelected
          ? current.student_ids.filter((id) => !ids.includes(id))
          : Array.from(new Set([...current.student_ids, ...ids])),
      };
    });

  const close = () => {
    setOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const startEdit = (plan: SessionPlan) => {
    setForm({
      title: plan.title,
      session_date: plan.session_date,
      session_time: plan.session_time?.slice(0, 5) ?? '',
      venue: plan.venue ?? '',
      coach_ids: plan.coach_ids,
      student_ids: studentIdsByPlan[plan.id] ?? [],
    });
    setEditingId(plan.id);
    setOpen(true);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    if (form.student_ids.length === 0) return setError('Select at least one student for the assessment.');
    setSaving(true);
    setError('');
    const payload = {
      session_type: 'assessment',
      title: form.title.trim(),
      session_date: form.session_date,
      session_time: form.session_time || null,
      venue: form.venue.trim() || null,
      coach_ids: form.coach_ids,
      student_count: form.student_ids.length,
      group_ability: 'Mixed ability',
    };
    let planId = editingId;
    if (editingId) {
      const { error: updateError } = await supabase.from('session_plans').update(payload).eq('id', editingId).eq('club_id', clubId);
      if (updateError) return fail(updateError.message);
      const { error: clearError } = await supabase.from('session_plan_students').delete().eq('session_plan_id', editingId).eq('club_id', clubId);
      if (clearError) return fail(clearError.message);
    } else {
      const { data, error: insertError } = await supabase.from('session_plans').insert({ ...payload, club_id: clubId }).select('id').single();
      if (insertError || !data) return fail(insertError?.message ?? 'Could not create assessment.');
      planId = data.id as string;
    }
    const { error: linkError } = await supabase.from('session_plan_students').insert(
      form.student_ids.map((student_id) => ({ club_id: clubId, session_plan_id: planId, student_id })),
    );
    if (linkError) return fail(linkError.message);
    setSaving(false);
    close();
    autoSyncCalendar(clubId);
    load();
  };

  const fail = (message: string) => {
    setError(message);
    setSaving(false);
  };

  const remove = async (plan: SessionPlan) => {
    if (!supabase || !window.confirm(`Delete "${plan.title}"?`)) return;
    const { error: deleteError } = await supabase.from('session_plans').delete().eq('id', plan.id).eq('club_id', clubId);
    if (deleteError) return setError(deleteError.message);
    autoSyncCalendar(clubId);
    load();
  };

  const today = new Date().toISOString().split('T')[0];
  const bands = GRADES.map((grade) => ({
    grade,
    students: students.filter((student) => gradeKeyFor(student.current_rank) === grade.key),
  })).filter((band) => band.students.length > 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Assessments</h2>
          <p className="text-xs text-slate-500">Set the assessment date and choose who is being assessed. Students see a countdown on their page.</p>
        </div>
        {!open && (
          <button onClick={() => setOpen(true)} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600">
            <CalendarPlus size={16} /> Create assessment
          </button>
        )}
      </div>

      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {open && (
        <form onSubmit={save} className="mt-4 space-y-4 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">{editingId ? 'Edit assessment' : 'New assessment'}</h3>
            <button type="button" onClick={close} aria-label="Cancel" className="text-slate-400 hover:text-slate-700"><X size={16} /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className={inputClass} placeholder="Title (e.g. Winter grading)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required aria-label="Title" />
            <input className={inputClass} placeholder="Venue" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} aria-label="Venue" />
            <label className="text-xs font-semibold text-slate-600">Assessment date
              <input className={`${inputClass} mt-1 font-normal`} type="date" value={form.session_date} onChange={(e) => setForm({ ...form, session_date: e.target.value })} required />
            </label>
            <label className="text-xs font-semibold text-slate-600">Start time
              <input className={`${inputClass} mt-1 font-normal`} type="time" value={form.session_time} onChange={(e) => setForm({ ...form, session_time: e.target.value })} />
            </label>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Examiners (Kup grade examiners)</p>
            {examiners.length === 0 ? (
              <p className="text-xs text-slate-400">No coaches are flagged as Kup examiners yet.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {examiners.map((coach) => (
                  <label key={coach.id} className="flex items-center gap-1.5 text-sm text-slate-700">
                    <input type="checkbox" className="accent-amber-500" checked={form.coach_ids.includes(coach.id)} onChange={() => toggle('coach_ids', coach.id)} />
                    {coach.full_name}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Students by grade band</p>
              <span className="text-xs text-slate-500">{form.student_ids.length} selected</span>
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {bands.length === 0 && <p className="text-sm text-slate-400">No students yet.</p>}
              {bands.map(({ grade, students: bandStudents }) => {
                const ids = bandStudents.map((student) => student.id);
                const allSelected = ids.every((id) => form.student_ids.includes(id));
                return (
                  <div key={grade.key} className="rounded-lg border border-slate-200 bg-white">
                    <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-1.5">
                      <span className="text-xs font-bold text-slate-800">{grade.label} · {grade.band}</span>
                      <button type="button" onClick={() => toggleBand(ids)} className="ml-auto text-xs font-semibold text-amber-700 hover:underline">
                        {allSelected ? 'Deselect band' : 'Select band'}
                      </button>
                    </div>
                    <div className="grid gap-x-4 px-3 py-1.5 sm:grid-cols-2">
                      {bandStudents.map((student) => (
                        <label key={student.id} className="flex items-center gap-2 py-0.5 text-sm text-slate-700">
                          <input type="checkbox" className="accent-amber-500" checked={form.student_ids.includes(student.id)} onChange={() => toggle('student_ids', student.id)} />
                          {student.student_name}
                          <span className="text-xs text-slate-400">{student.current_rank}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2">
            <button disabled={saving} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60">
              {saving ? 'Saving…' : editingId ? 'Save assessment' : 'Create assessment'}
            </button>
            <button type="button" onClick={close} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
          </div>
        </form>
      )}

      <div className="mt-4">
        {loading ? (
          <Loader2 className="animate-spin text-amber-500" />
        ) : assessments.length === 0 ? (
          <p className="text-sm text-slate-400">No assessments scheduled.</p>
        ) : (
          <ul className="space-y-2">
            {assessments.map((plan) => (
              <li key={plan.id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {plan.title}
                    {plan.session_date < today && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Past</span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {plan.session_date}{plan.session_time ? ` · ${plan.session_time.slice(0, 5)}` : ''}{plan.venue ? ` · ${plan.venue}` : ''} · {(studentIdsByPlan[plan.id] ?? []).length} students
                  </p>
                </div>
                <button onClick={() => startEdit(plan)} aria-label={`Edit ${plan.title}`} className="text-slate-500 hover:text-slate-900"><Pencil size={16} /></button>
                <button onClick={() => remove(plan)} aria-label={`Delete ${plan.title}`} className="text-red-600"><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
