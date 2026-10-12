import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Radio, X, Copy, Check, Users, Wifi, WifiOff, TrendingUp, MessageSquare, Gauge, Gavel, CheckCircle2, AlertTriangle, XCircle, Save, Loader2, Zap, Grid3x3, Swords, Target } from 'lucide-react';
import { supabase, type AssessmentSession, type SessionScore } from '@/lib/supabase';
import { buildModules, getFeedbackTier, getVerdict, GRADES, scoreColorIndex, type AssessmentModule, type GradeKey } from '@/data/rubrics';
import { exportPDF, exportCSV } from '@/lib/exportUtils';
import type { ExaminerScores } from '@/lib/supabase';
import type { ProfileData } from '@/components/StudentProfileHeader';

type Props = {
  sessionId: string;
  sessionCode: string;
  myExaminerId: string;
  myExaminerName: string;
  isHost: boolean;
  onExit: () => void;
};

const scoreColors = [
  '',
  'bg-red-500 text-white border-red-600',
  'bg-orange-500 text-white border-orange-600',
  'bg-amber-500 text-white border-amber-600',
  'bg-lime-500 text-white border-lime-600',
  'bg-emerald-600 text-white border-emerald-700',
];
const scoreRingColors = ['', 'ring-red-300', 'ring-orange-300', 'ring-amber-300', 'ring-lime-300', 'ring-emerald-400'];

const tierColors: Record<string, string> = {
  Developing: 'from-red-500 to-orange-500',
  Improving: 'from-orange-500 to-amber-500',
  Proficient: 'from-lime-500 to-emerald-500',
  Mastery: 'from-emerald-600 to-teal-600',
};
const tierBg: Record<string, string> = {
  Developing: 'bg-red-50 border-red-200',
  Improving: 'bg-amber-50 border-amber-200',
  Proficient: 'bg-emerald-50 border-emerald-200',
  Mastery: 'bg-teal-50 border-teal-200',
};
const verdictConfig: Record<string, { icon: typeof CheckCircle2; bg: string; text: string; border: string }> = {
  emerald: { icon: CheckCircle2, bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  amber: { icon: AlertTriangle, bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  red: { icon: XCircle, bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
};

function scoreColorHex(s: number): string {
  return ['', '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#059669'][s] ?? '#94a3b8';
}

export default function LiveSessionView({
  sessionId,
  sessionCode,
  myExaminerId,
  myExaminerName,
  isHost,
  onExit,
}: Props) {
  const [session, setSession] = useState<AssessmentSession | null>(null);
  const [allScores, setAllScores] = useState<SessionScore[]>([]);
  const [connected, setConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedEval, setSavedEval] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);

  // Load session and scores
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    (async () => {
      const { data: sess } = await client
        .from('assessment_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
      if (sess) setSession(sess as AssessmentSession);

      const { data: sc } = await client
        .from('session_scores')
        .select('*')
        .eq('session_id', sessionId);
      if (sc) setAllScores(sc as SessionScore[]);
    })();

    // Realtime subscriptions
    const channel = client
      .channel(`session:${sessionId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'session_scores', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setAllScores((prev) => prev.filter((s) => s.id !== payload.old.id));
          } else {
            const newScore = payload.new as SessionScore;
            setAllScores((prev) => {
              const idx = prev.findIndex(
                (s) => s.examiner_id === newScore.examiner_id && s.module_id === newScore.module_id && s.item_id === newScore.item_id
              );
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = newScore;
                return updated;
              }
              return [...prev, newScore];
            });
          }
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'assessment_sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setSession(payload.new as AssessmentSession);
          }
        }
      )
      .on('presence', { event: 'sync' }, () => {
        setConnected(true);
      })
      .on('presence', { event: 'join' }, () => setConnected(true))
      .on('presence', { event: 'leave' }, () => {})
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setConnected(true);
          await channel.track({ examiner_id: myExaminerId, name: myExaminerName });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnected(false);
        }
      });

    channelRef.current = channel;

    return () => {
      client.removeChannel(channel);
      channelRef.current = null;
    };
  }, [sessionId, myExaminerId, myExaminerName]);

  const maxScore = session?.target_mark ?? 1;
  const currentGrade = (session?.current_rank ?? '10-9 KUP') as GradeKey;
  const gradeInfo = GRADES.find((r) => r.key === currentGrade);
  const passMark = gradeInfo?.passMark ?? maxScore * 0.6;
  const modules = useMemo(() => buildModules(maxScore), [maxScore]);
  const totalItems = useMemo(() => modules.reduce((sum, m) => sum + m.items.length, 0), [modules]);

  // Build examinerScores map from allScores
  const examinerScores: ExaminerScores = useMemo(() => {
    const map: ExaminerScores = {};
    for (const s of allScores) {
      if (!map[s.examiner_id]) map[s.examiner_id] = {};
      if (!map[s.examiner_id][s.module_id]) map[s.examiner_id][s.module_id] = {};
      map[s.examiner_id][s.module_id][s.item_id] = s.score;
    }
    return map;
  }, [allScores]);

  // Examiners from session + scores
  const examiners = useMemo(() => {
    const nameMap = session?.examiner_names ?? {};
    const ids = new Set<string>([...Object.keys(nameMap), ...allScores.map((s) => s.examiner_id)]);
    return Array.from(ids).map((id) => ({ id, name: nameMap[id] ?? 'Unknown Examiner' }));
  }, [session, allScores]);

  const namedExaminers = examiners.filter((e) => e.name && e.name !== 'Unknown Examiner');
  const totalSlots = totalItems * Math.max(namedExaminers.length, 1);

  const combinedAverage = useMemo(() => {
    const all = allScores.map((s) => s.score);
    return all.length > 0 ? all.reduce((a, b) => a + b, 0) / all.length : 0;
  }, [allScores]);

  const scoredCount = allScores.length;
  const tier = getFeedbackTier(combinedAverage, maxScore);
  const verdict = getVerdict(combinedAverage, currentGrade);
  const gradient = tierColors[tier.tier] ?? 'from-slate-500 to-slate-700';
  const bg = tierBg[tier.tier] ?? 'bg-slate-50 border-slate-200';
  const vCfg = verdictConfig[verdict.color] ?? verdictConfig.amber;
  const VIcon = vCfg.icon;

  const myScores = examinerScores[myExaminerId] ?? {};
  const myScoredCount = useMemo(
    () => modules.reduce((sum, m) => sum + Object.keys(myScores[m.id] ?? {}).length, 0),
    [modules, myScores],
  );

  // Per-examiner averages
  const examinerAverages = useMemo(() => {
    return examiners.map((ex) => {
      const exScores = allScores.filter((s) => s.examiner_id === ex.id);
      const avg = exScores.length > 0 ? exScores.reduce((a, b) => a + b.score, 0) / exScores.length : 0;
      return { id: ex.id, name: ex.name, avg, count: exScores.length };
    });
  }, [examiners, allScores]);

  // Module combined averages
  const moduleCombined = useMemo(() => {
    return modules.map((m) => {
      const modScores = allScores.filter((s) => s.module_id === m.id);
      const avg = modScores.length > 0 ? modScores.reduce((a, b) => a + b.score, 0) / modScores.length : 0;
      return { id: m.id, title: m.title, avg, count: modScores.length };
    });
  }, [modules, allScores]);

  const handleScore = useCallback(
    async (moduleId: string, itemId: string, score: number) => {
      if (!supabase) return;
      const client = supabase;
      // Optimistic local update via realtime will handle it, but also upsert
      const existing = allScores.find(
        (s) => s.examiner_id === myExaminerId && s.module_id === moduleId && s.item_id === itemId
      );
      if (existing && existing.score === score) return;

      // Optimistic local
      setAllScores((prev) => {
        const idx = prev.findIndex(
          (s) => s.examiner_id === myExaminerId && s.module_id === moduleId && s.item_id === itemId
        );
        const newScore: SessionScore = existing
          ? { ...existing, score }
          : {
              id: `temp-${Date.now()}`,
              session_id: sessionId,
              examiner_id: myExaminerId,
              examiner_name: myExaminerName,
              module_id: moduleId,
              item_id: itemId,
              score,
              updated_at: new Date().toISOString(),
            };
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = newScore;
          return updated;
        }
        return [...prev, newScore];
      });

      await client
        .from('session_scores')
        .upsert(
          {
            session_id: sessionId,
            examiner_id: myExaminerId,
            examiner_name: myExaminerName,
            module_id: moduleId,
            item_id: itemId,
            score,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'session_id,examiner_id,module_id,item_id' }
        );
    },
    [allScores, myExaminerId, myExaminerName, sessionId],
  );

  const displayCode = sessionCode || session?.session_code || '';

  const copyCode = () => {
    navigator.clipboard.writeText(displayCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToEvaluations = async () => {
    if (!session) return;
    if (!supabase) return;
    const client = supabase;
    setSaving(true);
    const examinerNamesMap: Record<string, string> = {};
    for (const ex of examiners) {
      if (ex.name && ex.name !== 'Unknown Examiner') examinerNamesMap[ex.id] = ex.name;
    }
    const { error } = await client.from('evaluations').insert({
      student_name: session.student_name,
      candidate_id: session.candidate_id,
      current_rank: session.current_rank,
      target_rank: session.target_rank,
      examiner_name: namedExaminers.map((e) => e.name).join(', '),
      examiner_names: examinerNamesMap,
      evaluation_date: session.evaluation_date,
      scores: examinerScores,
      average_score: Number(combinedAverage.toFixed(2)),
      feedback_tier: tier.tier,
      training_advice: tier.advice,
      verdict: verdict.label,
    });
    setSaving(false);
    if (!error) {
      setSavedEval(true);
      // Mark session as completed
      await client.from('assessment_sessions').update({ status: 'completed' }).eq('id', sessionId);
    }
  };

  const handleExportPDF = () => {
    if (!session) return;
    const profile: ProfileData = {
      studentName: session.student_name,
      candidateId: session.candidate_id,
      currentGrade: currentGrade,
      targetGrade: session.target_rank,
      examiners: examiners.map((e) => ({ id: e.id, name: e.name })),
      date: session.evaluation_date,
    };
    exportPDF({ profile, examinerScores, combinedAverage, scoredItems: scoredCount, totalItems: totalSlots });
  };

  const handleExportCSV = () => {
    if (!session) return;
    const profile: ProfileData = {
      studentName: session.student_name,
      candidateId: session.candidate_id,
      currentGrade: currentGrade,
      targetGrade: session.target_rank,
      examiners: examiners.map((e) => ({ id: e.id, name: e.name })),
      date: session.evaluation_date,
    };
    exportCSV({ profile, examinerScores, combinedAverage, scoredItems: scoredCount, totalItems: totalSlots });
  };

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <Loader2 size={32} className="animate-spin text-amber-500" />
      </div>
    );
  }

  const sidebar = (
    <div className="space-y-4">
      {/* Verdict */}
      {scoredCount > 0 && (
        <div className={`overflow-hidden rounded-2xl border-2 ${vCfg.border} ${vCfg.bg} shadow-sm`}>
          <div className="flex items-center gap-3 px-5 py-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${vCfg.bg} ${vCfg.text}`}>
              <VIcon size={26} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Gavel size={14} className={vCfg.text} />
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Combined Verdict</span>
              </div>
              <p className={`text-lg font-extrabold ${vCfg.text}`}>{verdict.label}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{verdict.detail}</p>
            </div>
          </div>
        </div>
      )}

      {/* Combined gauge */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className={`bg-gradient-to-br ${gradient} px-6 py-5 text-white`}>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/80">
            <Gauge size={16} /> Combined Average
          </div>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-5xl font-extrabold tracking-tight">{combinedAverage.toFixed(2)}</span>
            <span className="mb-1.5 text-xl font-medium text-white/70">/ {maxScore.toFixed(1)}</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">{tier.tier}</span>
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">Pass: {passMark.toFixed(1)} / {maxScore}</span>
          </div>
        </div>
        <div className="px-6 py-4">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Overall Progress</span>
            <span>{scoredCount} / {totalSlots} scores</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-500`} style={{ width: `${totalSlots > 0 ? (scoredCount / totalSlots) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      {/* Examiners online */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
          <Users size={16} /> Examiners ({namedExaminers.length})
        </div>
        <div className="space-y-2.5">
          {examinerAverages.map((ex) => (
            <div key={ex.id}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium text-slate-700">
                  {ex.id === myExaminerId && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-700">You</span>}
                  {ex.name}
                </span>
                <span className="font-bold text-slate-900">{ex.count > 0 ? ex.avg.toFixed(2) : '—'}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-gradient-to-r from-slate-600 to-slate-800 transition-all duration-500" style={{ width: `${(ex.avg / maxScore) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Module breakdown */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
          <TrendingUp size={16} /> Combined Module Breakdown
        </div>
        <div className="space-y-2.5">
          {moduleCombined.map((m) => (
            <div key={m.id}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">{m.title.replace(/^Module \d+ — /, '')}</span>
                <span className="font-bold text-slate-900">{m.count > 0 ? m.avg.toFixed(1) : '—'}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-red-500 transition-all duration-500" style={{ width: `${(m.avg / maxScore) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Training advice */}
      <div className={`rounded-2xl border p-5 shadow-sm ${bg}`}>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
          <MessageSquare size={16} /> Combined Training Advice
        </div>
        <p className="text-sm leading-relaxed text-slate-800">{tier.advice}</p>
      </div>

      {/* Export & save (host only) */}
      {isHost && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Save & Export</h4>
          <div className="flex flex-wrap gap-2">
            <button onClick={handleExportPDF} disabled={scoredCount === 0} className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40">
              <Gauge size={14} /> PDF
            </button>
            <button onClick={handleExportCSV} disabled={scoredCount === 0} className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40">
              <TrendingUp size={14} /> CSV
            </button>
            <button onClick={handleSaveToEvaluations} disabled={scoredCount === 0 || saving || savedEval} className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-red-600 px-3 py-2 text-xs font-semibold text-white shadow-md transition hover:shadow-lg disabled:opacity-40">
              {saving ? <Loader2 size={14} className="animate-spin" /> : savedEval ? <CheckCircle2 size={14} /> : <Save size={14} />}
              {savedEval ? 'Saved' : saving ? 'Saving...' : 'Save to Records'}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-amber-50/30">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-red-600 text-white shadow-md">
              <Radio size={18} />
              {connected && <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white" />}
            </div>
            <div>
              <h1 className="text-sm font-extrabold tracking-tight text-slate-900 sm:text-base">
                Live Session · {session.student_name}
              </h1>
              <p className="hidden text-xs text-slate-500 sm:block">
                You: {myExaminerName} · {myScoredCount}/{totalItems} scored
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={copyCode} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50">
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span className="font-mono tracking-widest">{displayCode}</span>
            </button>
            <button onClick={() => setShowSidebar(!showSidebar)} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 lg:hidden">
              <TrendingUp size={16} />
            </button>
            <button onClick={onExit} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-red-50 hover:text-red-600">
              <X size={14} /> Exit
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Connection + session info bar */}
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2">
            {connected ? <Wifi size={16} className="text-emerald-500" /> : <WifiOff size={16} className="text-red-500" />}
            <span className="text-xs font-semibold text-slate-600">
              {connected ? 'Connected' : 'Reconnecting...'}
            </span>
          </div>
          <div className="h-4 w-px bg-slate-200" />
          <span className="text-xs font-semibold text-slate-500">Student ID: {session.candidate_id}</span>
          <div className="h-4 w-px bg-slate-200" />
          <span className="text-xs font-semibold text-slate-500">Grade: {session.current_rank} → {session.target_rank}</span>
          <div className="h-4 w-px bg-slate-200" />
          <span className="text-xs font-semibold text-slate-500">Date: {session.evaluation_date}</span>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Scoring area */}
          <div className="lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Your Scoring ({myExaminerName})</h3>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                {myScoredCount}/{totalItems} scored
              </span>
            </div>
            <div className="space-y-5">
              {modules.map((mod) => (
                <LiveModuleCard
                  key={mod.id}
                  module={mod}
                  myScores={myScores[mod.id] ?? {}}
                  onScore={(itemId, score) => handleScore(mod.id, itemId, score)}
                />
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className={showSidebar ? 'block' : 'hidden lg:block'}>
            <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
              {sidebar}
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white/50 py-6">
        <div className="mx-auto max-w-6xl px-4 text-center text-xs text-slate-400 sm:px-6">
          Live Session — Scores sync in real time across all connected examiners
        </div>
      </footer>
    </div>
  );
}

function LiveModuleCard({
  module,
  myScores,
  onScore,
}: {
  module: AssessmentModule;
  myScores: Record<string, number>;
  onScore: (itemId: string, score: number) => void;
}) {
  const iconMap: Record<string, typeof Zap> = { Zap, Grid3x3, Swords, Target };
  const IconCmp = iconMap[module.icon] ?? Zap;
  const scoredCount = Object.keys(myScores).length;
  const moduleAvg = scoredCount > 0 ? (Object.values(myScores).reduce((a, b) => a + b, 0) / scoredCount).toFixed(1) : '—';

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
            <IconCmp size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white sm:text-base">{module.title}</h3>
            <p className="text-xs text-slate-400">{scoredCount}/{module.items.length} items scored</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-400">Your Avg</span>
          <span className="rounded-lg bg-amber-500 px-2.5 py-1 text-sm font-bold text-white">{moduleAvg}/{module.maxScore}</span>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {module.items.map((item) => {
          const currentScore = myScores[item.id] ?? 0;
          return (
            <div key={item.id} className="px-4 py-3 sm:px-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">{item.label}</span>
                  {currentScore > 0 && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${scoreColors[scoreColorIndex(currentScore, module.maxScore)]}`}>
                      {currentScore}/{module.maxScore}
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5">
                  {Array.from({ length: module.maxScore }, (_, i) => i + 1).map((n) => {
                    const isSelected = currentScore === n;
                    const colorIdx = scoreColorIndex(n, module.maxScore);
                    return (
                      <button
                        key={n}
                        onClick={() => onScore(item.id, n)}
                        className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-bold transition-all ${
                          isSelected
                            ? `${scoreColors[colorIdx]} ring-2 ${scoreRingColors[colorIdx]} scale-110 shadow-md`
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
