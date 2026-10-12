import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { AlertTriangle, CalendarPlus, Download, Link2, Loader2, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import {
  COACH_RANKS,
  GROUP_ABILITIES,
  PLAN_SECTIONS,
  supabase,
  type Coach,
  type PlanSection,
  type SessionPlan,
  type SessionPlanActivity,
  type Student,
} from '@/lib/supabase';
import Timetable from '@/components/Timetable';
import { autoSyncCalendar } from '@/lib/googleCalendar';
import { SAMPLE_PLAN_CSV, parsePlanCSV, type ParsedPlanSession, type PlanActivityInput } from '@/lib/planCsv';

const emptyActivity: PlanActivityInput = {
  section: 'Main content',
  timing: '',
  description: '',
  content_activity: '',
  coaching_points: '',
};

const activityRows = (planId: string, clubId: string, rows: PlanActivityInput[]) =>
  rows.map((row, index) => ({
    session_plan_id: planId,
    club_id: clubId,
    sort_order: index,
    section: row.section,
    timing: row.timing.trim() || null,
    description: row.description.trim() || null,
    content_activity: row.content_activity.trim() || null,
    coaching_points: row.coaching_points.trim() || null,
  }));

type Props = {
  club: { id: string; name: string };
};

const NOT_APPLICABLE = 'Not applicable to this session';

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20';

const rankLabel = Object.fromEntries(COACH_RANKS.map((item) => [item.value, item.label]));

type FormState = {
  session_type: 'class' | 'assessment';
  title: string;
  student_count: string;
  age_range: string;
  group_ability: string;
  group_ability_other: string;
  medical_information: string;
  planning_summary: string;
  session_date: string;
  session_time: string;
  venue: string;
  facility_requirements: string;
  human_resources: string;
  coach_ids: string[];
  health_safety: string;
  previous_action_points: string;
  mentor: string;
  session_goals: string;
  adaptations: string;
  session_summary: string;
  injuries_reported: string;
};

const emptyForm: FormState = {
  session_type: 'class',
  title: '',
  student_count: '',
  age_range: '',
  group_ability: GROUP_ABILITIES[0],
  group_ability_other: '',
  medical_information: '',
  planning_summary: '',
  session_date: '',
  session_time: '',
  venue: '',
  facility_requirements: '',
  human_resources: '',
  coach_ids: [],
  health_safety: '',
  previous_action_points: NOT_APPLICABLE,
  mentor: '',
  session_goals: '',
  adaptations: '',
  session_summary: '',
  injuries_reported: '',
};

const fromPlan = (plan: SessionPlan): FormState => ({
  session_type: plan.session_type === 'assessment' ? 'assessment' : 'class',
  title: plan.title,
  student_count: plan.student_count?.toString() ?? '',
  age_range: plan.age_range ?? '',
  group_ability: plan.group_ability ?? GROUP_ABILITIES[0],
  group_ability_other: plan.group_ability_other ?? '',
  medical_information: plan.medical_information ?? '',
  planning_summary: plan.planning_summary ?? '',
  session_date: plan.session_date,
  session_time: plan.session_time?.slice(0, 5) ?? '',
  venue: plan.venue ?? '',
  facility_requirements: plan.facility_requirements ?? '',
  human_resources: plan.human_resources ?? '',
  coach_ids: plan.coach_ids,
  health_safety: plan.health_safety ?? '',
  previous_action_points: plan.previous_action_points,
  mentor: plan.mentor ?? '',
  session_goals: plan.session_goals ?? '',
  adaptations: plan.adaptations ?? '',
  session_summary: plan.session_summary ?? '',
  injuries_reported: plan.injuries_reported ?? '',
});

const orNull = (value: string) => value.trim() || null;

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid border-t border-slate-300 first:border-t-0 sm:grid-cols-[13rem_1fr]">
      <div className="bg-slate-200/70 px-3 py-2 text-sm font-semibold text-slate-800">
        {label}
        {hint && <span className="block text-xs font-normal text-slate-600">{hint}</span>}
      </div>
      <div className="bg-white p-2">{children}</div>
    </div>
  );
}

function Band({ children }: { children: ReactNode }) {
  return <div className="border-t border-slate-300 bg-slate-200/70 px-3 py-2 text-sm font-semibold text-slate-800 first:border-t-0">{children}</div>;
}

export default function SessionPlanning({ club }: Props) {
  const clubId = club.id;
  const [plans, setPlans] = useState<SessionPlan[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activities, setActivities] = useState<PlanActivityInput[]>([{ ...emptyActivity, section: 'Warm up' }, { ...emptyActivity }, { ...emptyActivity, section: 'Cool down' }]);
  const [activitiesByPlan, setActivitiesByPlan] = useState<Record<string, SessionPlanActivity[]>>({});
  const [importPreview, setImportPreview] = useState<{ sessions: ParsedPlanSession[]; errors: string[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentIdsByPlan, setStudentIdsByPlan] = useState<Record<string, string[]>>({});
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentQuery, setStudentQuery] = useState('');

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const [plansResult, coachesResult, activitiesResult, studentsResult, planStudentsResult] = await Promise.all([
      supabase.from('session_plans').select('*').eq('club_id', clubId).order('session_date').order('session_time'),
      supabase.from('coaches').select('*').eq('club_id', clubId).eq('active', true).order('full_name'),
      supabase.from('session_plan_activities').select('*').eq('club_id', clubId).order('sort_order'),
      supabase.from('students').select('*').eq('club_id', clubId).order('student_name'),
      supabase.from('session_plan_students').select('session_plan_id, student_id').eq('club_id', clubId),
    ]);
    const loadError = plansResult.error ?? coachesResult.error ?? activitiesResult.error ?? studentsResult.error ?? planStudentsResult.error;
    if (loadError) setError(loadError.message);
    else {
      setPlans((plansResult.data ?? []) as SessionPlan[]);
      setCoaches((coachesResult.data ?? []) as Coach[]);
      setStudents((studentsResult.data ?? []) as Student[]);
      const byPlan: Record<string, string[]> = {};
      (planStudentsResult.data ?? []).forEach((row) => {
        (byPlan[row.session_plan_id as string] ??= []).push(row.student_id as string);
      });
      setStudentIdsByPlan(byPlan);
      const grouped: Record<string, SessionPlanActivity[]> = {};
      ((activitiesResult.data ?? []) as SessionPlanActivity[]).forEach((item) => {
        (grouped[item.session_plan_id] ??= []).push(item);
      });
      setActivitiesByPlan(grouped);
    }
    setLoading(false);
  }, [clubId]);

  useEffect(() => {
    load();
  }, [load]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const toggleCoach = (id: string) =>
    set('coach_ids', form.coach_ids.includes(id) ? form.coach_ids.filter((item) => item !== id) : [...form.coach_ids, id]);

  const toggleStudent = (id: string) =>
    setSelectedStudentIds((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]));

  const visibleStudents = students.filter((student) =>
    student.student_name.toLowerCase().includes(studentQuery.trim().toLowerCase()),
  );

  const hasLeadership = (ids: string[]) =>
    ids.some((id) => {
      const coach = coaches.find((item) => item.id === id);
      return coach?.rank === 'lead' || coach?.rank === 'qualified';
    });

  const resetForm = () => {
    setForm(emptyForm);
    setActivities([{ ...emptyActivity, section: 'Warm up' }, { ...emptyActivity }, { ...emptyActivity, section: 'Cool down' }]);
    setEditingId(null);
    setSelectedStudentIds([]);
    setStudentQuery('');
  };

  const buildPayload = () => ({
    session_type: form.session_type,
    title: form.title.trim(),
    student_count: form.student_count === '' ? null : Math.max(0, Number(form.student_count)),
    age_range: orNull(form.age_range),
    group_ability: form.group_ability,
    group_ability_other: form.group_ability === 'Other' ? orNull(form.group_ability_other) : null,
    medical_information: orNull(form.medical_information),
    planning_summary: orNull(form.planning_summary),
    session_date: form.session_date,
    session_time: form.session_time || null,
    venue: orNull(form.venue),
    facility_requirements: orNull(form.facility_requirements),
    human_resources: orNull(form.human_resources),
    coach_ids: form.coach_ids,
    health_safety: orNull(form.health_safety),
    previous_action_points: form.previous_action_points.trim() || NOT_APPLICABLE,
    mentor: orNull(form.mentor),
    session_goals: orNull(form.session_goals),
    adaptations: orNull(form.adaptations),
    session_summary: orNull(form.session_summary),
    injuries_reported: orNull(form.injuries_reported),
  });

  const updateActivity = <K extends keyof PlanActivityInput>(index: number, key: K, value: PlanActivityInput[K]) =>
    setActivities((rows) => rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));

  const savePlan = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setError('');
    const payload = buildPayload();
    let planId = editingId;
    if (editingId) {
      const { error: updateError } = await supabase.from('session_plans').update(payload).eq('id', editingId).eq('club_id', clubId);
      if (updateError) return setError(updateError.message);
      const { error: clearError } = await supabase.from('session_plan_activities').delete().eq('session_plan_id', editingId).eq('club_id', clubId);
      if (clearError) return setError(clearError.message);
    } else {
      const { data, error: insertError } = await supabase.from('session_plans').insert({ ...payload, club_id: clubId }).select('id').single();
      if (insertError || !data) return setError(insertError?.message ?? 'Could not save plan.');
      planId = data.id as string;
    }
    const rows = activityRows(planId as string, clubId, activities.filter((row) => row.timing || row.description || row.content_activity || row.coaching_points));
    if (rows.length > 0) {
      const { error: activityError } = await supabase.from('session_plan_activities').insert(rows);
      if (activityError) return setError(activityError.message);
    }
    const { error: clearStudentsError } = await supabase.from('session_plan_students').delete().eq('session_plan_id', planId as string).eq('club_id', clubId);
    if (clearStudentsError) return setError(clearStudentsError.message);
    if (form.session_type === 'assessment' && selectedStudentIds.length > 0) {
      const { error: studentsError } = await supabase.from('session_plan_students').insert(
        selectedStudentIds.map((student_id) => ({ club_id: clubId, session_plan_id: planId, student_id })),
      );
      if (studentsError) return setError(studentsError.message);
    }
    resetForm();
    autoSyncCalendar(clubId);
    load();
  };

  const editPlan = (plan: SessionPlan) => {
    setForm(fromPlan(plan));
    setSelectedStudentIds(studentIdsByPlan[plan.id] ?? []);
    setActivities(
      (activitiesByPlan[plan.id] ?? []).map((item) => ({
        section: item.section,
        timing: item.timing ?? '',
        description: item.description ?? '',
        content_activity: item.content_activity ?? '',
        coaching_points: item.coaching_points ?? '',
      })),
    );
    setEditingId(plan.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const parsed = parsePlanCSV(await file.text());
    if (parsed.sessions.length === 0 && parsed.errors.length === 0) parsed.errors.push('No activity rows found.');
    if (parsed.sessions.length > 1 && parsed.sessions.some((item) => !item.session_date)) {
      parsed.errors.push('Every session needs a Date when importing more than one session.');
    }
    setImportPreview(parsed);
  };

  const loadImportIntoForm = () => {
    if (!importPreview || importPreview.sessions.length !== 1) return;
    const [session] = importPreview.sessions;
    setActivities(session.activities);
    setForm((current) => ({
      ...current,
      session_date: session.session_date ?? current.session_date,
      session_time: session.session_time ?? current.session_time,
      title: current.title || session.title || '',
    }));
    setImportPreview(null);
  };

  const confirmImport = async () => {
    if (!supabase || !importPreview) return;
    const missingDate = importPreview.sessions.some((item) => !item.session_date);
    if (missingDate) return setError('Add a Date column so each session can be scheduled.');
    setImporting(true);
    setError('');
    const base = buildPayload();
    const seriesId = importPreview.sessions.length > 1 ? crypto.randomUUID() : null;
    const created: string[] = [];
    for (const [index, session] of importPreview.sessions.entries()) {
      const { data, error: insertError } = await supabase
        .from('session_plans')
        .insert({
          ...base,
          club_id: clubId,
          series_id: seriesId,
          title: session.title ?? `${base.title || 'Session'} ${index + 1}`,
          session_date: session.session_date,
          session_time: session.session_time ?? base.session_time,
          session_summary: null,
          injuries_reported: null,
        })
        .select('id')
        .single();
      if (insertError || !data) {
        setError(insertError?.message ?? 'Import failed.');
        break;
      }
      created.push(data.id as string);
      const { error: activityError } = await supabase
        .from('session_plan_activities')
        .insert(activityRows(data.id as string, clubId, session.activities));
      if (activityError) {
        setError(activityError.message);
        break;
      }
    }
    setImporting(false);
    if (created.length === importPreview.sessions.length) setImportPreview(null);
    autoSyncCalendar(clubId);
    load();
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([SAMPLE_PLAN_CSV], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'session-plan-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const removePlan = async (plan: SessionPlan) => {
    if (!supabase || !window.confirm(`Delete "${plan.title}"?`)) return;
    const { error: deleteError } = await supabase
      .from('session_plans')
      .delete()
      .eq('id', plan.id)
      .eq('club_id', clubId);
    if (deleteError) setError(deleteError.message);
    else {
      if (editingId === plan.id) resetForm();
      autoSyncCalendar(clubId);
      load();
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const upcoming = plans.filter((plan) => plan.session_date >= today);
  const past = plans.filter((plan) => plan.session_date < today).reverse();

  const textarea = (key: keyof FormState, rows = 2) => (
    <textarea
      className={inputClass}
      rows={rows}
      value={form[key] as string}
      onChange={(e) => set(key, e.target.value as FormState[typeof key])}
    />
  );

  const renderPlan = (plan: SessionPlan) => {
    const assigned = plan.coach_ids
      .map((id) => coaches.find((coach) => coach.id === id))
      .filter((coach): coach is Coach => Boolean(coach));
    const ability = plan.group_ability === 'Other' ? plan.group_ability_other || 'Other' : plan.group_ability;
    const detail = (label: string, value: string | null) =>
      value ? <p className="text-sm text-slate-700"><span className="font-semibold">{label}:</span> {value}</p> : null;
    return (
      <li key={plan.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-900">{plan.title}</h3>
            {plan.session_type === 'assessment' && (
              <span className="mr-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                Assessment · {(studentIdsByPlan[plan.id] ?? []).length} students
              </span>
            )}
            {plan.series_id && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                <Link2 size={12} /> Linked series · {plans.filter((item) => item.series_id === plan.series_id).length} sessions
              </span>
            )}
            <p className="text-xs text-slate-500">
              {plan.session_date}
              {plan.session_time ? ` · ${plan.session_time.slice(0, 5)}` : ''}
              {plan.venue ? ` · ${plan.venue}` : ''}
              {plan.student_count !== null ? ` · ${plan.student_count} students` : ''}
              {ability ? ` · ${ability}` : ''}
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => editPlan(plan)} aria-label={`Edit ${plan.title}`} className="text-slate-500 hover:text-slate-900"><Pencil size={16} /></button>
            <button onClick={() => removePlan(plan)} aria-label={`Delete ${plan.title}`} className="text-red-600"><Trash2 size={16} /></button>
          </div>
        </div>
        {detail('Session goals', plan.session_goals)}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {assigned.map((coach) => (
            <span key={coach.id} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
              {coach.full_name} · {rankLabel[coach.rank]}
            </span>
          ))}
        </div>
        {!hasLeadership(plan.coach_ids) && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-600">
            <AlertTriangle size={14} /> No lead or qualified coach assigned
          </p>
        )}
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-xs font-semibold text-amber-700">Full session plan</summary>
          <div className="mt-2 space-y-1">
            {detail('Age range', plan.age_range)}
            {detail('Medical information', plan.medical_information)}
            {detail('Summary of information used to plan', plan.planning_summary)}
            {detail('Facility requirements', plan.facility_requirements)}
            {detail('Human resources', plan.human_resources)}
            {detail('Health and safety', plan.health_safety)}
            {detail('Action points from previous sessions', plan.previous_action_points)}
            {detail('Mentor', plan.mentor)}
            {detail('Adaptations', plan.adaptations)}
            {(activitiesByPlan[plan.id] ?? []).length > 0 && (
              <div className="overflow-x-auto pt-2">
                <table className="w-full border border-slate-300 text-left text-xs">
                  <thead className="bg-slate-200/70">
                    <tr>
                      {['Section', 'Timing', 'Description', 'Content / activity', 'Coaching points and physical preparations'].map((head) => (
                        <th key={head} className="border border-slate-300 px-2 py-1">{head}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(activitiesByPlan[plan.id] ?? []).map((item) => (
                      <tr key={item.id} className="align-top">
                        <td className="border border-slate-300 px-2 py-1 font-semibold">{item.section}</td>
                        <td className="border border-slate-300 px-2 py-1">{item.timing}</td>
                        <td className="border border-slate-300 px-2 py-1">{item.description}</td>
                        <td className="border border-slate-300 px-2 py-1">{item.content_activity}</td>
                        <td className="border border-slate-300 px-2 py-1">{item.coaching_points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {detail('Summary of session / feedback to students', plan.session_summary)}
            {detail('Injuries / accidents', plan.injuries_reported)}
          </div>
        </details>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <Timetable clubId={clubId} clubName={club.name} plans={plans} activitiesByPlan={activitiesByPlan} onOpenPlan={editPlan} />
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">
          {editingId ? 'Edit session plan' : 'Linked session planner'}
          <span className="ml-2 text-xs font-normal text-slate-500">Based on British Taekwondo Unit 7</span>
        </h2>
        {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <form onSubmit={savePlan} className="mt-4 space-y-5">
          <div className="overflow-hidden rounded-lg border border-slate-300">
            <Band>Session plan</Band>
            <Row label="Session type">
              <select className={inputClass} value={form.session_type} onChange={(e) => set('session_type', e.target.value as FormState['session_type'])} aria-label="Session type">
                <option value="class">Class / training session</option>
                <option value="assessment">Assessment session</option>
              </select>
            </Row>
            {form.session_type === 'assessment' && (
              <Row label="Students being assessed" hint="Students see a countdown and their previous feedback">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <input className={`${inputClass} sm:max-w-xs`} value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)} placeholder="Search students" aria-label="Search students" />
                  <button type="button" onClick={() => setSelectedStudentIds(Array.from(new Set([...selectedStudentIds, ...visibleStudents.map((s) => s.id)])))} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    Select all{studentQuery ? ' shown' : ''}
                  </button>
                  <button type="button" onClick={() => setSelectedStudentIds([])} className="text-xs font-semibold text-slate-500 hover:text-red-600">Clear</button>
                  <span className="ml-auto text-xs text-slate-500">{selectedStudentIds.length} selected</span>
                </div>
                <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200">
                  {visibleStudents.length === 0 ? (
                    <p className="p-3 text-sm text-slate-400">No students found.</p>
                  ) : visibleStudents.map((student) => (
                    <label key={student.id} className="flex cursor-pointer items-center gap-2 border-b border-slate-100 px-3 py-1.5 text-sm last:border-b-0 hover:bg-amber-50/50">
                      <input type="checkbox" className="accent-amber-500" checked={selectedStudentIds.includes(student.id)} onChange={() => toggleStudent(student.id)} />
                      <span className="font-medium text-slate-800">{student.student_name}</span>
                      <span className="text-xs text-slate-400">{student.current_rank}</span>
                    </label>
                  ))}
                </div>
              </Row>
            )}
            <Row label="Plan title">
              <input className={inputClass} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Session plan 1" required />
            </Row>
            <Row label="Number of students taking part">
              <div className="grid gap-2 sm:grid-cols-3">
                <input className={inputClass} type="number" min={0} value={form.student_count} onChange={(e) => set('student_count', e.target.value)} placeholder="Number of students" aria-label="Number of students" />
                <input className={inputClass} value={form.age_range} onChange={(e) => set('age_range', e.target.value)} placeholder="Age range (e.g. 7-11)" aria-label="Age range" />
                <select className={inputClass} value={form.group_ability} onChange={(e) => set('group_ability', e.target.value)} aria-label="Group ability">
                  {GROUP_ABILITIES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
              {form.group_ability === 'Other' && (
                <input className={`${inputClass} mt-2`} value={form.group_ability_other} onChange={(e) => set('group_ability_other', e.target.value)} placeholder="Please specify" aria-label="Group ability, other" />
              )}
            </Row>
            <Row label="Medical information">{textarea('medical_information')}</Row>
            <Row label="Summary of information used to plan the session">{textarea('planning_summary', 3)}</Row>

            <Band>Facilities, resources and session</Band>
            <Row label="Session date, time and club">
              <div className="grid gap-2 sm:grid-cols-3">
                <input className={inputClass} type="date" value={form.session_date} onChange={(e) => set('session_date', e.target.value)} aria-label="Session date" required />
                <input className={inputClass} type="time" value={form.session_time} onChange={(e) => set('session_time', e.target.value)} aria-label="Session time" />
                <input className={`${inputClass} bg-slate-50`} value={club.name} readOnly aria-label="Club" />
              </div>
            </Row>
            <Row label="Venue">
              <input className={inputClass} value={form.venue} onChange={(e) => set('venue', e.target.value)} />
            </Row>
            <Row label="Facility requirements">{textarea('facility_requirements')}</Row>
            <Row label="Human resources required" hint="for example other coaches and Welfare Officer">
              <fieldset>
                {coaches.length === 0 ? (
                  <p className="mb-2 text-sm text-slate-500">Add coaches in the Admin tab to assign them here.</p>
                ) : (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {coaches.map((coach) => (
                      <label key={coach.id} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${form.coach_ids.includes(coach.id) ? 'border-amber-500 bg-amber-50 text-amber-900' : 'border-slate-200 text-slate-600'}`}>
                        <input type="checkbox" className="sr-only" checked={form.coach_ids.includes(coach.id)} onChange={() => toggleCoach(coach.id)} />
                        {coach.full_name} · {rankLabel[coach.rank]}
                      </label>
                    ))}
                  </div>
                )}
                {form.coach_ids.length > 0 && !hasLeadership(form.coach_ids) && (
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-red-600">
                    <AlertTriangle size={14} /> Add a lead or qualified coach to run this session
                  </p>
                )}
                {textarea('human_resources')}
              </fieldset>
            </Row>
            <Row label="Health and safety considerations before session" hint="for example: equipment check, safety briefing, other (please specify)">
              {textarea('health_safety', 3)}
            </Row>
            <Row label="Action points from previous session(s)">{textarea('previous_action_points')}</Row>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-300">
            <Band>Session plan – timings and content</Band>
            <Row label="Mentor">
              <select className={inputClass} value={form.mentor} onChange={(e) => set('mentor', e.target.value)} aria-label="Mentor">
                <option value="">No mentor</option>
                {form.mentor && !coaches.some((coach) => coach.full_name === form.mentor) && (
                  <option value={form.mentor}>{form.mentor}</option>
                )}
                {coaches.map((coach) => (
                  <option key={coach.id} value={coach.full_name}>{coach.full_name} · {rankLabel[coach.rank]}</option>
                ))}
              </select>
            </Row>
            <Row label="Session goal(s)">{textarea('session_goals', 3)}</Row>
            <Row label="List of adaptations" hint="based on individual needs">{textarea('adaptations', 3)}</Row>
            <Band>Timings and section</Band>
            <div className="bg-white p-2">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  <Upload size={14} /> Import CSV
                  <input type="file" accept=".csv,text/csv" className="sr-only" onChange={handleImportFile} />
                </label>
                <button type="button" onClick={downloadTemplate} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-amber-700 hover:underline">
                  <Download size={14} /> Download CSV template
                </button>
                <span className="text-xs text-slate-500">Rows with a Date create one linked session per date.</span>
              </div>
              {importPreview && (
                <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-slate-800">
                  <p className="font-semibold">
                    {importPreview.sessions.length} session{importPreview.sessions.length === 1 ? '' : 's'} found �{' '}
                    {importPreview.sessions.reduce((sum, item) => sum + item.activities.length, 0)} activity rows
                  </p>
                  <ul className="mt-1 list-disc pl-5 text-xs">
                    {importPreview.sessions.map((item, index) => (
                      <li key={index}>{item.session_date ?? 'No date'} � {item.title ?? 'Untitled'} ({item.activities.length} rows)</li>
                    ))}
                  </ul>
                  {importPreview.errors.map((message) => <p key={message} className="mt-1 text-xs text-red-700">{message}</p>)}
                  <p className="mt-2 text-xs text-slate-600">
                    {editingId
                      ? 'Sessions with a date create new linked plans; the details above are copied to each.'
                      : 'The planning details above (students, venue, coaches, etc.) are copied to every session.'}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={confirmImport} disabled={importing || importPreview.errors.length > 0} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                      {importing ? 'Importing�' : 'Create linked sessions'}
                    </button>
                    {importPreview.sessions.length === 1 && importPreview.errors.length === 0 && (
                      <button type="button" onClick={loadImportIntoForm} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">
                        Load into this form instead
                      </button>
                    )}
                    <button type="button" onClick={() => setImportPreview(null)} className="px-3 py-1.5 text-xs font-semibold text-slate-600">Cancel</button>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {activities.map((activity, index) => (
                  <div key={index} className="grid gap-2 rounded-lg border border-slate-200 p-2 lg:grid-cols-[9rem_6rem_1fr_1fr_1fr_auto]">
                    <select className={inputClass} value={activity.section} onChange={(e) => updateActivity(index, 'section', e.target.value as PlanSection)} aria-label="Section">
                      {PLAN_SECTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                    <input className={inputClass} value={activity.timing} onChange={(e) => updateActivity(index, 'timing', e.target.value)} placeholder="Timing" aria-label="Timing" />
                    <textarea className={inputClass} rows={2} value={activity.description} onChange={(e) => updateActivity(index, 'description', e.target.value)} placeholder="Section description" aria-label="Section description" />
                    <textarea className={inputClass} rows={2} value={activity.content_activity} onChange={(e) => updateActivity(index, 'content_activity', e.target.value)} placeholder="Content / activity" aria-label="Content activity" />
                    <textarea className={inputClass} rows={2} value={activity.coaching_points} onChange={(e) => updateActivity(index, 'coaching_points', e.target.value)} placeholder="Coaching points and physical preparations" aria-label="Coaching points and physical preparations" />
                    <button type="button" onClick={() => setActivities((rows) => rows.filter((_, i) => i !== index))} aria-label="Remove row" className="self-start p-2 text-red-600"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setActivities((rows) => [...rows, { ...emptyActivity }])} className="mt-2 flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                <Plus size={14} /> Add row
              </button>
            </div>            <Row label="Summary of session / feedback to students">{textarea('session_summary', 3)}</Row>
            <Row label="Any injuries/accidents needing to be reported?" hint="Complete an Accident Report Form for each person involved">
              {textarea('injuries_reported')}
            </Row>
          </div>

          <div className="flex gap-2">
            <button className="flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">
              <CalendarPlus size={14} /> {editingId ? 'Update session plan' : 'Save session plan'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-amber-500" /></div>
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-base font-bold text-slate-900">Upcoming sessions</h2>
            <ul className="space-y-3">
              {upcoming.map(renderPlan)}
              {upcoming.length === 0 && <li className="text-sm text-slate-500">No upcoming sessions planned.</li>}
            </ul>
          </section>
          {past.length > 0 && (
            <section>
              <h2 className="mb-3 text-base font-bold text-slate-900">Past sessions</h2>
              <ul className="space-y-3">{past.map(renderPlan)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
