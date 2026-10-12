import { useState } from 'react';
import { Radio, X, Plus, LogIn, Loader2, AlertCircle, Copy, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { GRADES, gradeKeyFor } from '@/data/rubrics';
import type { ProfileData } from '@/components/StudentProfileHeader';

type Props = {
  profile: ProfileData;
  clubId: string;
  onClose: () => void;
  onSessionCreated: (sessionId: string, sessionCode: string, examinerId: string, examinerName: string) => void;
  onSessionJoined: (sessionId: string, examinerId: string, examinerName: string) => void;
};

function genSessionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function genExaminerId(): string {
  return `ex-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none placeholder:text-slate-400';

export default function LiveSessionModal({ profile, clubId, onClose, onSessionCreated, onSessionJoined }: Props) {
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [hostName, setHostName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdCode, setCreatedCode] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!hostName.trim()) {
      setError('Enter your name as the host examiner.');
      return;
    }
    if (!profile.studentName.trim() || !profile.candidateId.trim()) {
      setError('Fill in the student name and candidate ID in the profile before creating a session.');
      return;
    }
    if (!supabase) {
      setError('Live sessions require Supabase configuration.');
      return;
    }
    setLoading(true);
    setError('');
    const code = genSessionCode();
    const examinerId = genExaminerId();
    const currentGradeInfo = GRADES.find((r) => r.key === gradeKeyFor(profile.currentGrade));

    const { data, error: insertError } = await supabase
      .from('assessment_sessions')
      .insert({
        club_id: clubId,
        session_code: code,
        student_name: profile.studentName,
        candidate_id: profile.candidateId,
        current_rank: profile.currentGrade,
        target_rank: profile.targetGrade,
        target_mark: currentGradeInfo?.maxScore ?? 1,
        evaluation_date: profile.date,
        examiner_names: { [examinerId]: hostName.trim() },
        status: 'active',
      })
      .select()
      .single();

    setLoading(false);
    if (insertError || !data) {
      setError('Could not create the session. Please try again.');
      return;
    }
    setCreatedCode(code);
    onSessionCreated(data.id, code, examinerId, hostName.trim());
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) {
      setError('Enter the 6-character session code.');
      return;
    }
    if (!joinName.trim()) {
      setError('Enter your examiner name.');
      return;
    }
    if (!supabase) {
      setError('Live sessions require Supabase configuration.');
      return;
    }
    setLoading(true);
    setError('');
    const code = joinCode.trim().toUpperCase();

    const { data: session, error: queryError } = await supabase
      .from('assessment_sessions')
      .select('*')
      .eq('session_code', code)
      .eq('club_id', clubId)
      .eq('status', 'active')
      .maybeSingle();

    if (queryError || !session) {
      setLoading(false);
      setError('No active session found with that code. Check the code and try again.');
      return;
    }

    const examinerId = genExaminerId();
    const existingNames = (session.examiner_names as Record<string, string>) ?? {};
    const updatedNames = { ...existingNames, [examinerId]: joinName.trim() };

    const { error: updateError } = await supabase
      .from('assessment_sessions')
      .update({ examiner_names: updatedNames })
      .eq('id', session.id)
      .eq('club_id', clubId);
    if (updateError) {
      setLoading(false);
      setError(`Could not join the session: ${updateError.message}`);
      return;
    }

    setLoading(false);
    onSessionJoined(session.id, examinerId, joinName.trim());
  };

  const copyCode = () => {
    navigator.clipboard.writeText(createdCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
              <Radio size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Live Assessment Session</h2>
              <p className="text-xs text-slate-400">Multi-examiner realtime scoring</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3">
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {mode === 'choose' && (
            <div className="space-y-3">
              <button
                onClick={() => setMode('create')}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-4 text-left transition hover:border-amber-400 hover:bg-amber-50/30"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white">
                  <Plus size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Create a Session</p>
                  <p className="text-xs text-slate-500">Host a new live grading. Share the code with other examiners.</p>
                </div>
              </button>
              <button
                onClick={() => setMode('join')}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-4 text-left transition hover:border-amber-400 hover:bg-amber-50/30"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-700 text-amber-400">
                  <LogIn size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Join a Session</p>
                  <p className="text-xs text-slate-500">Enter a session code from the host to score in real time.</p>
                </div>
              </button>
            </div>
          )}

          {mode === 'create' && !createdCode && (
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                <p className="font-semibold text-slate-700">Session details:</p>
                <p className="mt-1">Student: {profile.studentName || '—'}</p>
                <p>Student ID: {profile.candidateId || '—'}</p>
                <p>Grade: {profile.currentGrade}</p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Your name (Host Examiner)
                </label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="e.g. Master Kim"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>
              <button
                onClick={handleCreate}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:shadow-lg disabled:opacity-50"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Radio size={18} />}
                {loading ? 'Creating...' : 'Create Live Session'}
              </button>
              <button
                onClick={() => { setMode('choose'); setError(''); }}
                className="w-full text-center text-xs font-semibold text-slate-500 underline"
              >
                Back
              </button>
            </div>
          )}

          {mode === 'create' && createdCode && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-slate-600">Share this code with other examiners:</p>
              <div className="flex items-center justify-center gap-3">
                <span className="rounded-xl bg-slate-900 px-6 py-3 text-3xl font-extrabold tracking-widest text-amber-400">
                  {createdCode}
                </span>
                <button
                  onClick={copyCode}
                  className="rounded-lg border border-slate-200 p-2.5 text-slate-600 transition hover:bg-slate-50"
                >
                  {copied ? <Check size={18} className="text-emerald-600" /> : <Copy size={18} />}
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Other examiners go to this app, click "Live Session", choose Join, and enter this code.
                Everyone scores at the same time and results combine automatically.
              </p>
              <button
                onClick={() => { setMode('choose'); setCreatedCode(''); }}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Done
              </button>
            </div>
          )}

          {mode === 'join' && (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Session Code
                </label>
                <input
                  type="text"
                  className={`${inputClass} text-center text-lg font-bold tracking-widest uppercase`}
                  placeholder="ABCDEF"
                  maxLength={6}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Your name (Examiner)
                </label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="e.g. Master Lee"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                />
              </div>
              <button
                onClick={handleJoin}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:shadow-lg disabled:opacity-50"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
                {loading ? 'Joining...' : 'Join Session'}
              </button>
              <button
                onClick={() => { setMode('choose'); setError(''); }}
                className="w-full text-center text-xs font-semibold text-slate-500 underline"
              >
                Back
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
