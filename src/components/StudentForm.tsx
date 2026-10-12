import { useState, type FormEvent } from 'react';
import { UserPlus } from 'lucide-react';
import { resolveStudentGrade, STUDENT_GRADES } from '@/data/rubrics';
import { validateStudent } from '@/lib/csvUtils';
import { BELT_SIZES, isUnder16, type Student, type StudentInput } from '@/lib/supabase';

type Props = {
  student: Student | null;
  onSave: (input: StudentInput) => Promise<void>;
  onCancel: () => void;
};

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20';

type FormState = {
  student_name: string;
  email: string;
  phone: string;
  guardian_name: string;
  guardian_email: string;
  date_of_birth: string;
  current_rank: string;
  last_grading_date: string;
  bt_membership_number: string;
  membership_expiry: string;
  belt_size: string;
};

const fromStudent = (student: Student | null): FormState => ({
  student_name: student?.student_name ?? '',
  email: student?.email ?? '',
  phone: student?.phone ?? '',
  guardian_name: student?.guardian_name ?? '',
  guardian_email: student?.guardian_email ?? '',
  date_of_birth: student?.date_of_birth ?? '',
  current_rank: resolveStudentGrade(student?.current_rank ?? '') ?? STUDENT_GRADES[0].label,
  last_grading_date: student?.last_grading_date ?? '',
  bt_membership_number: student?.bt_membership_number ?? '',
  membership_expiry: student?.membership_expiry ?? '',
  belt_size: student?.belt_size ?? '',
});

const orNull = (value: string) => value.trim() || null;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-slate-600">
      {label}
      <div className="mt-1 font-normal">{children}</div>
    </label>
  );
}

export default function StudentForm({ student, onSave, onCancel }: Props) {
  const [form, setForm] = useState<FormState>(() => fromStudent(student));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key: keyof FormState, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const needsGuardian = isUnder16(form.date_of_birth || null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const input: StudentInput = {
      student_name: form.student_name.trim(),
      email: orNull(form.email)?.toLowerCase() ?? null,
      phone: orNull(form.phone),
      guardian_name: orNull(form.guardian_name),
      guardian_email: orNull(form.guardian_email)?.toLowerCase() ?? null,
      date_of_birth: orNull(form.date_of_birth),
      current_rank: form.current_rank,
      last_grading_date: orNull(form.last_grading_date),
      bt_membership_number: orNull(form.bt_membership_number),
      membership_expiry: orNull(form.membership_expiry),
      belt_size: orNull(form.belt_size),
    };
    const problem = validateStudent(input);
    if (problem) return setError(problem);
    setSaving(true);
    setError('');
    try {
      await onSave(input);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save student.');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
        <UserPlus size={18} className="text-amber-600" /> {student ? 'Edit student' : 'Add student'}
      </h3>
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <input className={inputClass} value={form.student_name} onChange={(e) => set('student_name', e.target.value)} required />
        </Field>
        <Field label="Email (can be shared with family; or use the guardian's email)">
          <input className={inputClass} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required={!form.guardian_email.trim()} />
        </Field>
        <Field label="Phone">
          <input className={inputClass} type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="Date of birth">
          <input className={inputClass} type="date" max={new Date().toISOString().split('T')[0]} value={form.date_of_birth} onChange={(e) => set('date_of_birth', e.target.value)} />
        </Field>
        <Field label={needsGuardian ? "Guardian's name (required, under 16)" : "Guardian's name (if under 16)"}>
          <input className={inputClass} value={form.guardian_name} onChange={(e) => set('guardian_name', e.target.value)} required={needsGuardian} />
        </Field>
        <Field label="Guardian's email (linked contact; used if the student has no email)">
          <input className={inputClass} type="email" value={form.guardian_email} onChange={(e) => set('guardian_email', e.target.value)} required={!form.email.trim()} />
        </Field>
        <Field label="Current grade">
          <select className={inputClass} value={form.current_rank} onChange={(e) => set('current_rank', e.target.value)} required>
            {STUDENT_GRADES.map((grade) => <option key={grade.label} value={grade.label}>{grade.label}</option>)}
          </select>
        </Field>
        <Field label="Date of last grading">
          <input className={inputClass} type="date" value={form.last_grading_date} onChange={(e) => set('last_grading_date', e.target.value)} />
        </Field>
        <Field label="BT membership number">
          <input className={inputClass} value={form.bt_membership_number} onChange={(e) => set('bt_membership_number', e.target.value)} />
        </Field>
        <Field label="Membership expiry">
          <input className={inputClass} type="date" value={form.membership_expiry} onChange={(e) => set('membership_expiry', e.target.value)} />
        </Field>
        <Field label="Belt size (cm)">
          <input className={inputClass} list="belt-sizes" value={form.belt_size} onChange={(e) => set('belt_size', e.target.value)} />
          <datalist id="belt-sizes">
            {BELT_SIZES.map((size) => <option key={size} value={size} />)}
          </datalist>
        </Field>
      </div>

      <div className="mt-4 flex gap-2">
        <button disabled={saving} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50">
          {saving ? 'Saving…' : student ? 'Update student' : 'Add student'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">
          Cancel
        </button>
      </div>
    </form>
  );
}
