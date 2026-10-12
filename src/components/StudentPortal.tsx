import { CalendarClock, LogOut, MapPin, MessageSquare, Target } from 'lucide-react';
import { buildModules, GRADES, gradeKeyFor } from '@/data/rubrics';
import type { ExaminerScores } from '@/lib/supabase';

export type PortalAssessment = {
  id: string;
  title: string;
  session_date: string;
  session_time: string | null;
  venue: string | null;
};

export type PortalEvaluation = {
  id: string;
  evaluation_date: string;
  current_rank: string;
  target_rank: string;
  average_score: number;
  feedback_tier: string | null;
  training_advice: string | null;
  verdict: string | null;
  scores: ExaminerScores;
};

export type PortalEntry = {
  student: { id: string; student_name: string; current_rank: string };
  club_name: string;
  assessments: PortalAssessment[];
  evaluations: PortalEvaluation[];
};

type Props = {
  entries: PortalEntry[];
  email: string;
  onSignOut: () => void;
};

const daysUntil = (date: string) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${date}T00:00:00`).getTime() - start.getTime()) / 86_400_000);
};

const countdownText = (days: number) =>
  days <= 0 ? 'Assessment today' : days === 1 ? '1 day to go' : `${days} days to go`;

// The lowest-scoring items in an evaluation, averaged across examiners.
function focusAreas(evaluation: PortalEvaluation) {
  const gradeInfo = GRADES.find((grade) => grade.key === gradeKeyFor(evaluation.current_rank));
  const modules = buildModules(gradeInfo?.maxScore ?? 1);
  const items: { module: string; label: string; avg: number; max: number }[] = [];
  for (const module of modules) {
    for (const item of module.items) {
      const marks = Object.values(evaluation.scores ?? {})
        .map((byModule) => byModule?.[module.id]?.[item.id])
        .filter((mark): mark is number => typeof mark === 'number');
      if (marks.length > 0) {
        items.push({
          module: module.title.replace(/^Module \d+ — /, ''),
          label: item.label,
          avg: marks.reduce((a, b) => a + b, 0) / marks.length,
          max: module.maxScore,
        });
      }
    }
  }
  return items.sort((a, b) => a.avg / a.max - b.avg / b.max).slice(0, 3);
}

export default function StudentPortal({ entries, email, onSignOut }: Props) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-amber-50/30">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-base font-extrabold text-slate-900">My assessment</h1>
            <p className="text-xs text-slate-500">{email}</p>
          </div>
          <button onClick={onSignOut} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        {entries.map((entry) => {
          const next = entry.assessments[0];
          const latest = entry.evaluations[0];
          const areas = latest ? focusAreas(latest) : [];
          return (
            <section key={entry.student.id} className="space-y-4">
              <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 p-5 text-white shadow-lg">
                <h2 className="text-lg font-extrabold">{entry.student.student_name}</h2>
                <p className="text-sm text-slate-300">{entry.student.current_rank} · {entry.club_name}</p>
              </div>

              {next ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
                    <CalendarClock size={16} /> Your next assessment
                  </div>
                  <p className="mt-2 text-3xl font-extrabold text-slate-900">{countdownText(daysUntil(next.session_date))}</p>
                  <p className="mt-1 text-sm text-slate-700">
                    {next.title} · {next.session_date}
                    {next.session_time ? ` at ${next.session_time.slice(0, 5)}` : ''}
                  </p>
                  {next.venue && (
                    <p className="mt-1 flex items-center gap-1 text-sm text-slate-600"><MapPin size={14} /> {next.venue}</p>
                  )}
                  {entry.assessments.length > 1 && (
                    <p className="mt-2 text-xs text-slate-500">
                      Also scheduled: {entry.assessments.slice(1).map((a) => a.session_date).join(', ')}
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
                  You have no assessment scheduled yet. Your coach will add you when one is planned.
                </div>
              )}

              {latest ? (
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">Feedback from your last assessment</h3>
                    <span className="text-xs text-slate-500">{latest.evaluation_date}</span>
                    {latest.verdict && (
                      <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">{latest.verdict}</span>
                    )}
                  </div>
                  {areas.length > 0 && (
                    <div>
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        <Target size={14} /> What to work on
                      </div>
                      <ul className="space-y-1.5">
                        {areas.map((area) => (
                          <li key={`${area.module}-${area.label}`} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                            <span><span className="font-semibold text-slate-800">{area.label}</span> <span className="text-xs text-slate-400">{area.module}</span></span>
                            <span className="text-xs font-bold text-slate-600">{area.avg.toFixed(1)} / {area.max}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {latest.training_advice && (
                    <div>
                      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        <MessageSquare size={14} /> Coach feedback
                      </div>
                      <p className="text-sm leading-relaxed text-slate-700">{latest.training_advice}</p>
                    </div>
                  )}
                  {entry.evaluations.length > 1 && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-xs font-semibold text-amber-700">Earlier assessments</summary>
                      <ul className="mt-2 space-y-2">
                        {entry.evaluations.slice(1).map((evaluation) => (
                          <li key={evaluation.id} className="rounded-lg bg-slate-50 p-3">
                            <p className="text-xs font-semibold text-slate-600">{evaluation.evaluation_date} · {evaluation.verdict ?? 'Assessed'}</p>
                            {evaluation.training_advice && <p className="mt-1 text-sm text-slate-700">{evaluation.training_advice}</p>}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
                  No previous assessment feedback yet.
                </div>
              )}
            </section>
          );
        })}
      </main>
    </div>
  );
}
