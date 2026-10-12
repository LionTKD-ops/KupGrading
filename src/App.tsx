import { useState, useEffect, useMemo, useCallback } from 'react';
import { Swords, ShieldCheck, Award, RotateCcw, Radio } from 'lucide-react';
import StudentProfileHeader, { type ProfileData } from '@/components/StudentProfileHeader';
import ClubAccess, { type Club } from '@/components/ClubAccess';
import AssessmentModules from '@/components/AssessmentModules';
import FeedbackSummary from '@/components/FeedbackSummary';
import ExportActions from '@/components/ExportActions';
import SavedEvaluations from '@/components/SavedEvaluations';
import StudentImport from '@/components/StudentImport';
import StudentForm from '@/components/StudentForm';
import StudentList from '@/components/StudentList';
import LiveSessionModal from '@/components/LiveSessionModal';
import LiveSessionView from '@/components/LiveSessionView';
import AdminView from '@/components/AdminView';
import SessionPlanning from '@/components/SessionPlanning';
import { supabase, supabaseConfigured, type Evaluation, type Student, type StudentInput, type ExaminerScores } from '@/lib/supabase';
import { buildModules, GRADES, getFeedbackTier, getVerdict, gradeKeyFor, nextStudentGrade, resolveStudentGrade, STUDENT_GRADES } from '@/data/rubrics';
import { demoStudents, demoEvaluations, demoExaminerScores, demoProfile } from '@/data/demoData';
import { exportPDF, exportCSV } from '@/lib/exportUtils';
import type { ParsedStudent } from '@/lib/csvUtils';

type LiveSessionState = {
  sessionId: string;
  sessionCode: string;
  examinerId: string;
  examinerName: string;
  isHost: boolean;
} | null;

const today = new Date().toISOString().split('T')[0];

const emptyProfile: ProfileData = {
  studentName: '',
  candidateId: '',
  currentGrade: STUDENT_GRADES[0].label,
  targetGrade: STUDENT_GRADES[1].label,
  examiners: [{ id: 'ex-1', name: '' }],
  date: today,
};

export default function App() {
  if (!supabaseConfigured) return <GradingApp club={null} />;
  return (
    <ClubAccess>
      {(club) => <GradingApp club={club} />}
    </ClubAccess>
  );
}

function GradingApp({ club }: { club: Club | null }) {
  const [profile, setProfile] = useState<ProfileData>(supabaseConfigured ? emptyProfile : demoProfile);
  const [examinerScores, setExaminerScores] = useState<ExaminerScores>(supabaseConfigured ? {} : demoExaminerScores);
  const [activeExaminerId, setActiveExaminerId] = useState<string | null>(null);
  const [savedEvals, setSavedEvals] = useState<Evaluation[]>(supabaseConfigured ? [] : demoEvaluations);
  const [loadingEvals, setLoadingEvals] = useState(supabaseConfigured);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [students, setStudents] = useState<Student[]>(supabaseConfigured ? [] : demoStudents);
  const [loadingStudents, setLoadingStudents] = useState(supabaseConfigured);
  const [dataError, setDataError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [liveSession, setLiveSession] = useState<LiveSessionState>(null);
  const [view, setView] = useState<'assessment' | 'students' | 'planning' | 'admin'>(club ? 'admin' : 'assessment');

  const currentGradeInfo = GRADES.find((r) => r.key === gradeKeyFor(profile.currentGrade));
  const maxScore = currentGradeInfo?.maxScore ?? 1;
  const passMark = currentGradeInfo?.passMark ?? maxScore * 0.6;
  const modules = useMemo(
    () => buildModules(maxScore),
    [maxScore],
  );

  const totalItems = useMemo(
    () => modules.reduce((sum, m) => sum + m.items.length, 0),
    [modules],
  );

  const activeExaminers = profile.examiners;

  // Ensure activeExaminerId is valid
  useEffect(() => {
    if (activeExaminers.length === 0) {
      setActiveExaminerId(null);
    } else if (!activeExaminerId || !activeExaminers.some((e) => e.id === activeExaminerId)) {
      setActiveExaminerId(activeExaminers[0].id);
    }
  }, [activeExaminers, activeExaminerId]);

  // Combined scored items across all examiners
  const scoredItems = useMemo(() => {
    let count = 0;
    for (const ex of activeExaminers) {
      const exScores = examinerScores[ex.id] ?? {};
      for (const m of modules) {
        count += Object.keys(exScores[m.id] ?? {}).length;
      }
    }
    return count;
  }, [modules, examinerScores, activeExaminers]);

  // Combined average across all examiners' scores
  const combinedAverage = useMemo(() => {
    const all: number[] = [];
    for (const ex of activeExaminers) {
      const exScores = examinerScores[ex.id] ?? {};
      for (const m of modules) {
        const ms = exScores[m.id];
        if (ms) {
          for (const item of m.items) {
            if (ms[item.id] !== undefined) all.push(ms[item.id]);
          }
        }
      }
    }
    return all.length > 0 ? all.reduce((a, b) => a + b, 0) / all.length : 0;
  }, [modules, examinerScores, activeExaminers]);

  const namedExaminers = activeExaminers.filter((e) => e.name.trim() !== '');
  const canSave =
    profile.studentName.trim() !== '' &&
    profile.candidateId.trim() !== '' &&
    namedExaminers.length >= 1 &&
    scoredItems > 0;

  const handleScoreChange = useCallback(
    (examinerId: string, moduleId: string, itemId: string, score: number) => {
      setExaminerScores((prev) => ({
        ...prev,
        [examinerId]: {
          ...(prev[examinerId] ?? {}),
          [moduleId]: {
            ...((prev[examinerId] ?? {})[moduleId] ?? {}),
            [itemId]: score,
          },
        },
      }));
      setSaved(false);
    },
    [],
  );

  const handleProfileChange = useCallback(
    (data: ProfileData) => {
      if (gradeKeyFor(data.currentGrade) !== gradeKeyFor(profile.currentGrade)) {
        setExaminerScores({});
      }
      setProfile(data);
      setSaved(false);
    },
    [profile.currentGrade],
  );

  const loadStudents = useCallback(async () => {
    if (!supabase) {
      setStudents(demoStudents);
      setLoadingStudents(false);
      return;
    }
    setLoadingStudents(true);
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('club_id', club?.id ?? '')
      .order('created_at', { ascending: false });
    if (error) {
      setDataError(`Could not load students: ${error.message}`);
    } else if (data) {
      setStudents(data as Student[]);
    }
    setLoadingStudents(false);
  }, [club?.id]);

  const loadEvaluations = useCallback(async () => {
    if (!supabase) {
      setSavedEvals(demoEvaluations);
      setLoadingEvals(false);
      return;
    }
    setLoadingEvals(true);
    const { data, error } = await supabase
      .from('evaluations')
      .select('*')
      .eq('club_id', club?.id ?? '')
      .order('created_at', { ascending: false });
    if (error) {
      setDataError(`Could not load saved evaluations: ${error.message}`);
    } else if (data) {
      setSavedEvals(data as Evaluation[]);
    }
    setLoadingEvals(false);
  }, [club?.id]);

  useEffect(() => {
    loadEvaluations();
    loadStudents();
  }, [loadEvaluations, loadStudents]);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    const tier = getFeedbackTier(combinedAverage, maxScore);
    const verdict = getVerdict(combinedAverage, profile.currentGrade);
    const examinerNamesMap: Record<string, string> = {};
    for (const ex of profile.examiners) {
      if (ex.name.trim()) examinerNamesMap[ex.id] = ex.name;
    }
    const evaluation: Evaluation = {
      id: `local-${Date.now()}`,
      club_id: club?.id ?? 'demo-club',
      student_name: profile.studentName,
      candidate_id: profile.candidateId,
      current_rank: profile.currentGrade,
      target_rank: profile.targetGrade,
      examiner_name: namedExaminers.map((e) => e.name).join(', '),
      examiner_names: examinerNamesMap,
      evaluation_date: profile.date,
      scores: examinerScores,
      average_score: Number(combinedAverage.toFixed(2)),
      feedback_tier: tier.tier,
      training_advice: tier.advice,
      verdict: verdict.label,
      created_at: new Date().toISOString(),
    };
    if (!supabase) {
      setSavedEvals((current) => [evaluation, ...current]);
      setSaving(false);
      setSaved(true);
      return;
    }
    const { error } = await supabase.from('evaluations').insert({
      club_id: club?.id,
      student_name: profile.studentName,
      candidate_id: profile.candidateId,
      current_rank: profile.currentGrade,
      target_rank: profile.targetGrade,
      examiner_name: namedExaminers.map((e) => e.name).join(', '),
      examiner_names: examinerNamesMap,
      evaluation_date: profile.date,
      scores: examinerScores,
      average_score: Number(combinedAverage.toFixed(2)),
      feedback_tier: tier.tier,
      training_advice: tier.advice,
      verdict: verdict.label,
    });
    setSaving(false);
    if (error) {
      setDataError(`Could not save evaluation: ${error.message}`);
    } else {
      setSaved(true);
      loadEvaluations();
    }
  };

  const handleSelectEval = (ev: Evaluation) => {
    const examinerNamesMap = ev.examiner_names ?? {};
    // If old-style single examiner, reconstruct from examiner_name
    let examiners;
    if (examinerNamesMap && Object.keys(examinerNamesMap).length > 0) {
      examiners = Object.entries(examinerNamesMap).map(([id, name]) => ({ id, name }));
    } else if (ev.examiner_name) {
      examiners = [{ id: 'ex-legacy', name: ev.examiner_name }];
    } else {
      examiners = [{ id: 'ex-1', name: '' }];
    }

    // Detect if scores are per-examiner (nested 3 levels) or flat (old style)
    const firstModule = Object.keys(ev.scores ?? {})[0];
    const firstItem = firstModule ? Object.keys(ev.scores[firstModule] ?? {})[0] : undefined;
    const firstValue = firstItem ? ev.scores[firstModule][firstItem] : undefined;
    const isPerExaminer = typeof firstValue === 'object' && firstValue !== null;

    let restoredScores: ExaminerScores;
    if (isPerExaminer) {
      restoredScores = ev.scores as ExaminerScores;
    } else {
      // Old-style flat scores: assign to first examiner
      const firstExId = examiners[0]?.id ?? 'ex-1';
      restoredScores = { [firstExId]: ev.scores as unknown as Record<string, Record<string, number>> };
    }

    setProfile({
      studentName: ev.student_name,
      candidateId: ev.candidate_id,
      currentGrade: resolveStudentGrade(ev.current_rank) ?? ev.current_rank,
      targetGrade: ev.target_rank,
      examiners,
      date: ev.evaluation_date,
    });
    setExaminerScores(restoredScores);
    setActiveExaminerId(examiners[0]?.id ?? null);
    setSaved(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteEval = async (id: string) => {
    if (!supabase) {
      setSavedEvals((current) => current.filter((evaluation) => evaluation.id !== id));
      return;
    }
    const { error } = await supabase.from('evaluations').delete().eq('id', id).eq('club_id', club?.id ?? '');
    if (error) {
      setDataError(`Could not delete evaluation: ${error.message}`);
    } else {
      loadEvaluations();
    }
  };

  const handleReset = () => {
    setProfile(emptyProfile);
    setExaminerScores({});
    setActiveExaminerId(null);
    setSaved(false);
  };

  const handleSessionCreated = (sessionId: string, sessionCode: string, examinerId: string, examinerName: string) => {
    setShowSessionModal(false);
    setLiveSession({ sessionId, sessionCode, examinerId, examinerName, isHost: true });
  };

  const handleSessionJoined = (sessionId: string, examinerId: string, examinerName: string) => {
    setShowSessionModal(false);
    setLiveSession({ sessionId, sessionCode: '', examinerId, examinerName, isHost: false });
  };

  const handleExitSession = () => {
    setLiveSession(null);
  };

  const insertDemoStudents = (rows: StudentInput[]) => {
    const createdAt = new Date().toISOString();
    setStudents((current) => [
      ...rows.map((student, index) => ({
        ...student,
        club_id: 'demo-club',
        id: `local-${Date.now()}-${index}`,
        created_at: createdAt,
      })),
      ...current,
    ]);
  };

  const handleImportStudents = async (parsed: ParsedStudent[]) => {
    if (!supabase) return insertDemoStudents(parsed);
    const { error } = await supabase.from('students').insert(parsed.map((student) => ({ ...student, club_id: club?.id })));
    if (error) throw new Error(`Could not import students: ${error.message}`);
    await loadStudents();
  };

  const handleSaveStudent = async (input: StudentInput) => {
    if (!supabase) {
      if (editingStudent) {
        setStudents((current) => current.map((item) => (item.id === editingStudent.id ? { ...item, ...input } : item)));
      } else {
        insertDemoStudents([input]);
      }
    } else {
      const { error } = editingStudent
        ? await supabase.from('students').update(input).eq('id', editingStudent.id).eq('club_id', club?.id ?? '')
        : await supabase.from('students').insert({ ...input, club_id: club?.id });
      if (error) throw new Error(error.message);
      await loadStudents();
    }
    setEditingStudent(null);
    setShowStudentForm(false);
  };
  const handleSelectStudent = (c: Student) => {
    setProfile({
      studentName: c.student_name,
      candidateId: c.email ?? c.guardian_email ?? '',
      currentGrade: resolveStudentGrade(c.current_rank) ?? STUDENT_GRADES[0].label,
      targetGrade: nextStudentGrade(c.current_rank),
      examiners: [{ id: 'ex-1', name: '' }],
      date: today,
    });
    setExaminerScores({});
    setActiveExaminerId(null);
    setSaved(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteStudent = async (id: string) => {
    if (!supabase) {
      setStudents((current) => current.filter((student) => student.id !== id));
      return;
    }
    const { error } = await supabase.from('students').delete().eq('id', id).eq('club_id', club?.id ?? '');
    if (error) {
      setDataError(`Could not delete student: ${error.message}`);
    } else {
      loadStudents();
    }
  };

  const exportData = { profile, examinerScores, combinedAverage, scoredItems, totalItems };

  // Live session full-screen view
  if (liveSession) {
    return (
      <LiveSessionView
        sessionId={liveSession.sessionId}
        clubId={club?.id ?? ''}
        sessionCode={liveSession.sessionCode}
        myExaminerId={liveSession.examinerId}
        myExaminerName={liveSession.examinerName}
        isHost={liveSession.isHost}
        onExit={handleExitSession}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-amber-50/30">
      {showSessionModal && (
        <LiveSessionModal
          profile={profile}
          clubId={club?.id ?? ''}
          onClose={() => setShowSessionModal(false)}
          onSessionCreated={handleSessionCreated}
          onSessionJoined={handleSessionJoined}
        />
      )}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-red-600 text-white shadow-md">
              <Swords size={18} />
            </div>
            <div>
              <h1 className="text-sm font-extrabold tracking-tight text-slate-900 sm:text-base">
                Club Portal
              </h1>
              <p className="hidden text-xs text-slate-500 sm:block">Dojang progress tracker and assessment</p>
              {club && (
                <p className="text-[11px] text-slate-500">
                  {club.name} · Staff join code: <span className="font-mono font-semibold">{club.join_code}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSessionModal(true)}
              disabled={!supabaseConfigured}
              title={!supabaseConfigured ? 'Live sessions require Supabase configuration' : undefined}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Radio size={14} /> Live Session
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <RotateCcw size={14} /> Reset
            </button>
            {club && (
              <button
                onClick={async () => {
                  if (!supabase) return;
                  const { error } = await supabase.auth.signOut();
                  if (error) setDataError(`Could not sign out: ${error.message}`);
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </header>

      <nav aria-label="Dashboard sections" className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl gap-1 px-4 sm:px-6">
          {([['admin', 'Admin'], ['students', 'Students'], ['planning', 'Session planning'], ['assessment', 'Assessment']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              aria-current={view === key ? 'page' : undefined}
              className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition ${view === key ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      {(view === 'admin' || view === 'planning') && (
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          {club ? (
            view === 'admin' ? <AdminView club={club} /> : <SessionPlanning club={club} />
          ) : (
            <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Coaches and session planning need a connected Supabase database and a signed-in club.
            </div>
          )}
        </main>
      )}

      {view === 'students' && (
        <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
          {!supabaseConfigured && (
            <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Demo preview: students you add stay in this page only.
            </div>
          )}
          {dataError && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {dataError}
            </div>
          )}
          {showStudentForm ? (
            <StudentForm
              student={editingStudent}
              onSave={handleSaveStudent}
              onCancel={() => {
                setEditingStudent(null);
                setShowStudentForm(false);
              }}
            />
          ) : (
            <button
              onClick={() => setShowStudentForm(true)}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
            >
              Add student
            </button>
          )}
          <StudentImport onImport={handleImportStudents} />
          <StudentList
            students={students}
            loading={loadingStudents}
            onSelect={(student) => {
              handleSelectStudent(student);
              setView('assessment');
            }}
            onEdit={(student) => {
              setEditingStudent(student);
              setShowStudentForm(true);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onDelete={handleDeleteStudent}
          />
        </main>
      )}

      {view === 'assessment' && (
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {!supabaseConfigured && (
          <div role="status" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span className="font-semibold">Demo preview:</span> sample grading data is shown so you can explore the app. Changes stay in this page only. Configure <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_URL</code> and <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_ANON_KEY</code> to connect your database and enable live sessions.
          </div>
        )}
        {dataError && (
          <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {dataError}
          </div>
        )}
        <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 shadow-lg sm:p-8">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
                <ShieldCheck size={28} />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-white sm:text-2xl">
                  Student Record Journey
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Each examiner scores independently — results combine for a verdict against the grade's pass mark
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2.5 backdrop-blur-sm">
              <Award size={18} className="text-amber-400" />
              <div className="text-xs">
                <div className="font-semibold text-white">Training band: {currentGradeInfo?.band}</div>
                <div className="text-slate-400">Max {maxScore} · Pass {passMark.toFixed(1)}</div>
              </div>
            </div>
          </div>
        </div>

        <StudentProfileHeader data={profile} onChange={handleProfileChange} />

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Assessment Modules</h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                {scoredItems} scores across {namedExaminers.length} examiner{namedExaminers.length !== 1 ? 's' : ''}
              </span>
            </div>
            <AssessmentModules
              modules={modules}
              examinerScores={examinerScores}
              examiners={activeExaminers}
              activeExaminerId={activeExaminerId}
              onActiveExaminerChange={setActiveExaminerId}
              onScoreChange={handleScoreChange}
            />
          </div>

          <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">
            <FeedbackSummary
              combinedAverage={combinedAverage}
              totalItems={totalItems * Math.max(namedExaminers.length, 1)}
              scoredItems={scoredItems}
              modules={modules}
              examinerScores={examinerScores}
              examiners={activeExaminers}
              currentGrade={profile.currentGrade}
              maxScore={maxScore}
              passMark={passMark}
            />

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Export & Save
              </h4>
              <ExportActions
                onExportPDF={() => exportPDF(exportData)}
                onExportCSV={() => exportCSV(exportData)}
                onSave={handleSave}
                saving={saving}
                saved={saved}
                canSave={canSave}
              />
              {!canSave && (
                <p className="mt-3 text-xs text-slate-400">
                  Fill in the student name, ID, add at least one examiner with a name, and score at least one item.
                </p>
              )}
            </div>

            <SavedEvaluations
              evaluations={savedEvals}
              loading={loadingEvals}
              onSelect={handleSelectEval}
              onDelete={handleDeleteEval}
            />
          </div>
        </div>
      </main>
      )}

      <footer className="border-t border-slate-200 bg-white/50 py-6">
        <div className="mx-auto max-w-6xl px-4 text-center text-xs text-slate-400 sm:px-6">
          Club Portal — Dojang progress tracker and assessment
        </div>
      </footer>
    </div>
  );
}
