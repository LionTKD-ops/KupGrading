import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Loader2, Pencil, Trash2, UserPlus } from 'lucide-react';
import { BELT_SIZES, COACH_RANKS, DAN_GRADES, supabase, type Coach, type CoachQualification, type CoachRank } from '@/lib/supabase';
import QualificationsCell from '@/components/QualificationsCell';

type Props = {
  club: { id: string; name: string; join_code: string };
};

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20';

const rankOrder: Record<CoachRank, number> = { lead: 0, qualified: 1, assistant: 2, trainee: 3 };

const rankStyle: Record<CoachRank, string> = {
  lead: 'bg-red-100 text-red-800',
  qualified: 'bg-amber-100 text-amber-800',
  assistant: 'bg-sky-100 text-sky-800',
  trainee: 'bg-slate-100 text-slate-700',
};

type StudentSource = Pick<Coach, 'full_name' | 'email' | 'phone' | 'dan_grade' | 'date_of_birth' | 'last_grading_date' | 'bt_membership_number' | 'membership_expiry' | 'belt_size'>;

const danToStudentGrade = (dan: string | null) => dan ?? '1st Dan';

export default function AdminView({ club }: Props) {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [rank, setRank] = useState<CoachRank>('trainee');
  const [danGrade, setDanGrade] = useState<string>(DAN_GRADES[0]);
  const [expiry, setExpiry] = useState('');
  const [dob, setDob] = useState('');
  const [lastGrading, setLastGrading] = useState('');
  const [btNumber, setBtNumber] = useState('');
  const [membershipExpiry, setMembershipExpiry] = useState('');
  const [beltSize, setBeltSize] = useState('');
  const [notice, setNotice] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [qualifications, setQualifications] = useState<CoachQualification[]>([]);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const [coachesResult, qualificationsResult] = await Promise.all([
      supabase.from('coaches').select('*').eq('club_id', club.id).order('full_name'),
      supabase.from('coach_qualifications').select('*').eq('club_id', club.id),
    ]);
    const loadError = coachesResult.error ?? qualificationsResult.error;
    if (loadError) setError(loadError.message);
    else {
      setCoaches((coachesResult.data ?? []) as Coach[]);
      setQualifications((qualificationsResult.data ?? []) as CoachQualification[]);
    }
    setLoading(false);
  }, [club.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Coaches also train, so each coach with an email gets a matching student record.
  const syncStudent = async (coach: StudentSource) => {
    if (!supabase || !coach.email) return null;
    const email = coach.email.trim().toLowerCase();
    const fields = {
      student_name: coach.full_name,
      phone: coach.phone,
      date_of_birth: coach.date_of_birth,
      last_grading_date: coach.last_grading_date,
      bt_membership_number: coach.bt_membership_number,
      membership_expiry: coach.membership_expiry,
      belt_size: coach.belt_size,
    };
    const { data, error: findError } = await supabase.from('students').select('id').eq('club_id', club.id).ilike('email', email).ilike('student_name', coach.full_name).maybeSingle();
    if (findError) return findError.message;
    const { error: writeError } = data
      ? await supabase.from('students').update(fields).eq('id', data.id).eq('club_id', club.id)
      : await supabase.from('students').insert({ ...fields, email, club_id: club.id, current_rank: danToStudentGrade(coach.dan_grade) });
    return writeError ? writeError.message : null;
  };

  const addAllToStudents = async () => {
    setError('');
    setNotice('');
    const withEmail = coaches.filter((coach) => coach.email);
    const problems = (await Promise.all(withEmail.map(syncStudent))).filter(Boolean);
    if (problems.length) setError(problems[0] as string);
    else setNotice(`${withEmail.length} coach(es) added to student records.`);
  };

  const resetForm = () => {
    setEditingId(null);
    setFullName('');
    setEmail('');
    setPhone('');
    setRank('trainee');
    setDanGrade(DAN_GRADES[0]);
    setExpiry('');
    setDob('');
    setLastGrading('');
    setBtNumber('');
    setMembershipExpiry('');
    setBeltSize('');
  };

  const startEdit = (coach: Coach) => {
    setEditingId(coach.id);
    setFullName(coach.full_name);
    setEmail(coach.email ?? '');
    setPhone(coach.phone ?? '');
    setRank(coach.rank);
    setDanGrade(coach.dan_grade ?? DAN_GRADES[0]);
    setExpiry(coach.qualification_expiry ?? '');
    setDob(coach.date_of_birth ?? '');
    setLastGrading(coach.last_grading_date ?? '');
    setBtNumber(coach.bt_membership_number ?? '');
    setMembershipExpiry(coach.membership_expiry ?? '');
    setBeltSize(coach.belt_size ?? '');
    setError('');
  };

  const saveCoach = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setError('');
    const values = {
      full_name: fullName.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      rank,
      dan_grade: danGrade,
      qualification_expiry: expiry || null,
      date_of_birth: dob || null,
      last_grading_date: lastGrading || null,
      bt_membership_number: btNumber.trim() || null,
      membership_expiry: membershipExpiry || null,
      belt_size: beltSize.trim() || null,
    };
    const { error: insertError } = editingId
      ? await supabase.from('coaches').update(values).eq('id', editingId).eq('club_id', club.id)
      : await supabase.from('coaches').insert({ ...values, club_id: club.id });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    const studentProblem = await syncStudent(values);
    if (studentProblem) setError(`Coach saved, but the student record failed: ${studentProblem}`);
    resetForm();
    load();
  };

  const updateCoach = async (
    coach: Coach,
    changes: Partial<
      Pick<Coach, 'rank' | 'active' | 'dan_grade' | 'date_of_birth' | 'last_grading_date' | 'bt_membership_number' | 'membership_expiry' | 'belt_size'>
    >,
  ) => {
    if (!supabase) return;
    setError('');
    const { error: updateError } = await supabase
      .from('coaches')
      .update(changes)
      .eq('id', coach.id)
      .eq('club_id', club.id);
    if (updateError) setError(updateError.message);
    else load();
  };

  const removeCoach = async (coach: Coach) => {
    if (!supabase || !window.confirm(`Remove ${coach.full_name} from the coach list?`)) return;
    setError('');
    const { error: deleteError } = await supabase
      .from('coaches')
      .delete()
      .eq('id', coach.id)
      .eq('club_id', club.id);
    if (deleteError) setError(deleteError.message);
    else load();
  };

  const sorted = [...coaches].sort(
    (a, b) => rankOrder[a.rank] - rankOrder[b.rank] || a.full_name.localeCompare(b.full_name),
  );
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Club</h2>
        <p className="mt-1 text-sm text-slate-600">{club.name}</p>
        <p className="mt-1 text-xs text-slate-500">
          Staff join code: <span className="font-mono font-semibold">{club.join_code}</span>
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Coaches</h2>
        <ul className="mt-2 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
          {COACH_RANKS.map((item) => (
            <li key={item.value}><span className="font-semibold">{item.label}:</span> {item.description}</li>
          ))}
        </ul>

        <button type="button" onClick={addAllToStudents} className="mt-3 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          Add all coaches to student records
        </button>
        {notice && <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <form onSubmit={saveCoach} className="mt-4 grid gap-3 sm:grid-cols-6">
          <input className={`${inputClass} sm:col-span-2`} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" required />
          <input className={`${inputClass} sm:col-span-2`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <input className={`${inputClass} sm:col-span-2`} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
          <select className={`${inputClass} sm:col-span-2`} value={rank} onChange={(e) => setRank(e.target.value as CoachRank)} aria-label="Coach rank">
            {COACH_RANKS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <select className={`${inputClass} sm:col-span-2`} value={danGrade} onChange={(e) => setDanGrade(e.target.value)} aria-label="Dan grade" required>
            {DAN_GRADES.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
          </select>
          <input className={`${inputClass} sm:col-span-1`} type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} aria-label="Qualification expiry" title="Qualification expiry" />
          <label className="text-xs text-slate-500 sm:col-span-2">Date of birth
            <input className={inputClass} type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </label>
          <label className="text-xs text-slate-500 sm:col-span-2">Date of last grading
            <input className={inputClass} type="date" value={lastGrading} onChange={(e) => setLastGrading(e.target.value)} />
          </label>
          <label className="text-xs text-slate-500 sm:col-span-2">BT membership number
            <input className={inputClass} value={btNumber} onChange={(e) => setBtNumber(e.target.value)} />
          </label>
          <label className="text-xs text-slate-500 sm:col-span-2">Membership expiry
            <input className={inputClass} type="date" value={membershipExpiry} onChange={(e) => setMembershipExpiry(e.target.value)} />
          </label>
          <label className="text-xs text-slate-500 sm:col-span-2">Belt size
            <input className={inputClass} list="coach-belt-sizes" value={beltSize} onChange={(e) => setBeltSize(e.target.value)} />
            <datalist id="coach-belt-sizes">{BELT_SIZES.map((size) => <option key={size} value={size} />)}</datalist>
          </label>
          <button className="flex items-center justify-center gap-1.5 self-end rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600 sm:col-span-1">
            <UserPlus size={14} /> {editingId ? 'Save' : 'Add'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="self-end rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 sm:col-span-1">
              Cancel
            </button>
          )}
        </form>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-amber-500" /></div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Coach</th>
                  <th className="py-2 pr-3">Rank</th>
                  <th className="py-2 pr-3">Dan grade</th>
                  <th className="py-2 pr-3">Qualifications</th>
                  <th className="py-2 pr-3">Qualification expiry</th>
                  <th className="py-2 pr-3">Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sorted.map((coach) => (
                  <tr key={coach.id} className="border-t border-slate-100">
                    <td className="py-2 pr-3">
                      <div className="font-medium text-slate-900">{coach.full_name}</div>
                      <div className="text-xs text-slate-500">{[coach.email, coach.phone].filter(Boolean).join(' · ')}</div>
                      <div className="text-xs text-slate-400">
                        {[
                          coach.date_of_birth && `DOB ${coach.date_of_birth}`,
                          coach.bt_membership_number && `BT ${coach.bt_membership_number}`,
                          coach.belt_size && `Belt ${coach.belt_size}`,
                          coach.last_grading_date && `Last grading ${coach.last_grading_date}`,
                        ].filter(Boolean).join(' · ')}
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                        <span>Membership expiry</span>
                        <input
                          type="date"
                          defaultValue={coach.membership_expiry ?? ''}
                          onBlur={(e) => e.target.value !== (coach.membership_expiry ?? '') && updateCoach(coach, { membership_expiry: e.target.value || null })}
                          className={`rounded border border-slate-200 px-1 py-0.5 ${coach.membership_expiry && coach.membership_expiry < today ? 'text-red-600' : ''}`}
                          aria-label={`Membership expiry for ${coach.full_name}`}
                        />
                      </div>
                    </td>
                    <td className="py-2 pr-3">
                      <select
                        value={coach.rank}
                        onChange={(e) => updateCoach(coach, { rank: e.target.value as CoachRank })}
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${rankStyle[coach.rank]}`}
                        aria-label={`Rank for ${coach.full_name}`}
                      >
                        {COACH_RANKS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <select
                        value={coach.dan_grade ?? ''}
                        onChange={(e) => updateCoach(coach, { dan_grade: e.target.value })}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                        aria-label={`Dan grade for ${coach.full_name}`}
                      >
                        {!coach.dan_grade && <option value="" disabled>Select grade</option>}
                        {coach.dan_grade && !(DAN_GRADES as readonly string[]).includes(coach.dan_grade) && (
                          <option value={coach.dan_grade}>{coach.dan_grade}</option>
                        )}
                        {DAN_GRADES.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <QualificationsCell
                        clubId={club.id}
                        coachId={coach.id}
                        coachName={coach.full_name}
                        qualifications={qualifications.filter((item) => item.coach_id === coach.id)}
                        onChanged={load}
                        onError={setError}
                      />
                    </td>
                    <td className={`py-2 pr-3 ${coach.qualification_expiry && coach.qualification_expiry < today ? 'font-semibold text-red-600' : ''}`}>
                      {coach.qualification_expiry ?? '—'}
                    </td>
                    <td className="py-2 pr-3">
                      <button onClick={() => updateCoach(coach, { active: !coach.active })} className="text-xs text-slate-600 hover:underline">
                        {coach.active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="py-2 text-right">
                      <button onClick={() => { startEdit(coach); window.scrollTo({ top: 0, behavior: 'smooth' }); }} aria-label={`Edit ${coach.full_name}`} className="mr-2 text-slate-600"><Pencil size={16} /></button>
                      <button onClick={() => removeCoach(coach)} aria-label={`Remove ${coach.full_name}`} className="text-red-600"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr><td colSpan={7} className="py-6 text-center text-slate-500">No coaches yet. Add your first coach above.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
