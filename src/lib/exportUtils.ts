import type { ProfileData } from '@/components/StudentProfileHeader';
import type { ExaminerScores } from '@/lib/supabase';
import { buildModules, getFeedbackTier, getVerdict, GRADES, scoreColorIndex } from '@/data/rubrics';

type ExportData = {
  profile: ProfileData;
  examinerScores: ExaminerScores;
  combinedAverage: number;
  scoredItems: number;
  totalItems: number;
};

export function exportCSV(data: ExportData) {
  const { profile, examinerScores, combinedAverage } = data;
  const gradeInfo = GRADES.find((r) => r.key === profile.currentGrade);
  const maxScore = gradeInfo?.maxScore ?? 1;
  const passMark = gradeInfo?.passMark ?? maxScore * 0.6;
  const modules = buildModules(maxScore);
  const tier = getFeedbackTier(combinedAverage, maxScore);
  const verdict = getVerdict(combinedAverage, profile.currentGrade);
  const examinerNames = profile.examiners.map((e) => e.name || 'Unnamed').join('; ');

  const rows: string[][] = [];
  rows.push(['Field', 'Value']);
  rows.push(['Student Name', profile.studentName]);
  rows.push(['Student ID', profile.candidateId]);
  rows.push(['Current Grade', profile.currentGrade]);
  rows.push(['Target Grade', profile.targetGrade]);
  rows.push(['Max Score', String(maxScore)]);
  rows.push(['Pass Mark (60%)', passMark.toFixed(1)]);
  rows.push(['Examiners', examinerNames]);
  rows.push(['Date', profile.date]);
  rows.push(['Combined Average', combinedAverage.toFixed(2)]);
  rows.push(['Feedback Tier', tier.tier]);
  rows.push(['Verdict', verdict.label]);
  rows.push(['Training Advice', tier.advice]);
  rows.push([]);

  // Per-examiner scores
  rows.push(['Examiner', 'Module', 'Item', 'Score']);
  for (const ex of profile.examiners) {
    const exName = ex.name || 'Unnamed';
    const exScores = examinerScores[ex.id] ?? {};
    for (const mod of modules) {
      for (const item of mod.items) {
        const score = exScores[mod.id]?.[item.id] ?? '';
        rows.push([exName, mod.title, item.label, String(score)]);
      }
    }
  }
  rows.push([]);

  // Combined averages per module
  rows.push(['Module', 'Combined Average']);
  for (const mod of modules) {
    let sum = 0;
    let count = 0;
    for (const ex of profile.examiners) {
      const ms = (examinerScores[ex.id] ?? {})[mod.id] ?? {};
      for (const item of mod.items) {
        if (ms[item.id] !== undefined) {
          sum += ms[item.id];
          count++;
        }
      }
    }
    rows.push([mod.title, count > 0 ? (sum / count).toFixed(2) : '—']);
  }

  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `evaluation_${profile.candidateId || 'report'}_${profile.date || 'nodate'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportPDF(data: ExportData) {
  const { profile, examinerScores, combinedAverage, scoredItems, totalItems } = data;
  const gradeInfoPdf = GRADES.find((r) => r.key === profile.currentGrade);
  const maxScorePdf = gradeInfoPdf?.maxScore ?? 1;
  const passMarkPdf = gradeInfoPdf?.passMark ?? maxScorePdf * 0.6;
  const modules = buildModules(maxScorePdf);
  const tier = getFeedbackTier(combinedAverage, maxScorePdf);
  const verdict = getVerdict(combinedAverage, profile.currentGrade);
  const currentGradeInfo = gradeInfoPdf;
  const examinerNamesJoined = profile.examiners.map((e) => e.name || 'Unnamed').join(', ');

  const win = window.open('', '_blank');
  if (!win) return;

  // Per-examiner averages table
  const examinerRows = profile.examiners
    .map((ex, idx) => {
      const exScores = examinerScores[ex.id] ?? {};
      const all: number[] = [];
      for (const m of modules) {
        const ms = exScores[m.id];
        if (ms) {
          for (const item of m.items) {
            if (ms[item.id] !== undefined) all.push(ms[item.id]);
          }
        }
      }
      const avg = all.length > 0 ? all.reduce((a, b) => a + b, 0) / all.length : 0;
      return `<tr>
        <td style="padding:6px 12px;font-weight:600;color:#1e293b;">${idx + 1}. ${escapeHtml(ex.name || 'Unnamed')}</td>
        <td style="padding:6px 12px;text-align:center;font-weight:700;color:${scoreColor(scoreColorIndex(Math.round(avg), maxScorePdf))};">${avg.toFixed(2)}</td>
      </tr>`;
    })
    .join('');

  // Combined module scores
  const moduleRows = modules
    .map((mod) => {
      let sum = 0;
      let count = 0;
      for (const ex of profile.examiners) {
        const ms = (examinerScores[ex.id] ?? {})[mod.id] ?? {};
        for (const item of mod.items) {
          if (ms[item.id] !== undefined) {
            sum += ms[item.id];
            count++;
          }
        }
      }
      const modAvg = count > 0 ? (sum / count).toFixed(1) : '—';

      const itemRows = mod.items
        .map((item) => {
          let itemSum = 0;
          let itemCount = 0;
          for (const ex of profile.examiners) {
            const s = (examinerScores[ex.id] ?? {})[mod.id]?.[item.id];
            if (s !== undefined) {
              itemSum += s;
              itemCount++;
            }
          }
          const itemAvg = itemCount > 0 ? (itemSum / itemCount).toFixed(1) : '—';
          const rawAvg = itemCount > 0 ? itemSum / itemCount : 0;
          const colorIdx = itemCount > 0 ? scoreColorIndex(Math.round(rawAvg), mod.maxScore) : 0;
          const color = itemCount > 0 ? scoreColor(colorIdx) : '#94a3b8';
          return `<tr><td style="padding:4px 12px;color:#475569;">${item.label}</td><td style="padding:4px 12px;text-align:center;font-weight:700;color:${color};">${itemAvg}${itemCount > 0 ? '/' + mod.maxScore : ''}</td></tr>`;
        })
        .join('');

      return `
        <div style="margin-bottom:16px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
          <div style="background:#1e293b;color:#fff;padding:8px 16px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:700;font-size:13px;">${mod.title}</span>
            <span style="background:#f59e0b;color:#fff;padding:2px 10px;border-radius:6px;font-size:12px;font-weight:700;">Combined Avg ${modAvg}</span>
          </div>
          <table style="width:100%;font-size:12px;">${itemRows}</table>
        </div>`;
    })
    .join('');

  const tierGradient: Record<string, string> = {
    Developing: 'linear-gradient(135deg,#ef4444,#f97316)',
    Improving: 'linear-gradient(135deg,#f97316,#f59e0b)',
    Proficient: 'linear-gradient(135deg,#84cc16,#10b981)',
    Mastery: 'linear-gradient(135deg,#059669,#0d9488)',
  };

  const verdictColor: Record<string, string> = {
    emerald: '#059669',
    amber: '#d97706',
    red: '#dc2626',
  };
  const vColor = verdictColor[verdict.color] ?? '#64748b';

  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Evaluation Report — ${escapeHtml(profile.studentName)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background: #f1f5f9; color: #1e293b; padding: 24px; }
  .card { max-width: 720px; margin: 0 auto; background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); overflow: hidden; }
  .header { background: linear-gradient(135deg, #1e293b, #0f172a); padding: 28px 32px; color: #fff; }
  .header h1 { font-size: 22px; font-weight: 800; margin-bottom: 4px; }
  .header p { font-size: 13px; color: #94a3b8; }
  .badge { display: inline-block; background: #f59e0b; color: #fff; padding: 3px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; margin-top: 8px; }
  .verdict-banner { padding: 16px 32px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; gap: 12px; }
  .verdict-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800; color: #fff; background: ${vColor}; }
  .verdict-label { font-size: 18px; font-weight: 800; color: ${vColor}; }
  .verdict-detail { font-size: 12px; color: #64748b; margin-top: 2px; line-height: 1.5; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; padding: 0; border-bottom: 1px solid #e2e8f0; }
  .info-item { padding: 12px 24px; border-bottom: 1px solid #f1f5f9; }
  .info-item:nth-child(odd) { border-right: 1px solid #f1f5f9; }
  .info-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 2px; }
  .info-value { font-size: 14px; font-weight: 600; color: #1e293b; }
  .score-section { padding: 24px 32px; }
  .score-gauge { background: ${tierGradient[tier.tier] || 'linear-gradient(135deg,#64748b,#334155)'}; border-radius: 12px; padding: 20px 24px; color: #fff; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
  .score-gauge .avg { font-size: 42px; font-weight: 800; }
  .score-gauge .avg span { font-size: 18px; opacity: 0.7; font-weight: 400; }
  .score-gauge .tier { text-align: right; }
  .score-gauge .tier-name { font-size: 18px; font-weight: 700; }
  .score-gauge .tier-range { font-size: 12px; opacity: 0.8; }
  .examiner-table { width: 100%; margin-bottom: 16px; font-size: 13px; }
  .examiner-table th { text-align: left; padding: 6px 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; border-bottom: 1px solid #e2e8f0; }
  .examiner-table td { padding: 6px 12px; border-bottom: 1px solid #f1f5f9; }
  .advice { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px 20px; margin-bottom: 20px; }
  .advice-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 6px; }
  .advice-text { font-size: 13px; line-height: 1.6; color: #334155; }
  .section-title { font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 12px; padding: 0 4px; }
  .footer { padding: 16px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
  @media print { body { padding: 0; } .card { box-shadow: none; border-radius: 0; } }
</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Martial Arts Grading & Assessment Report</h1>
      <p>Multi-Examiner Combined Evaluation Summary</p>
      <span class="badge">${escapeHtml(currentGradeInfo?.band ?? '')} — Max ${maxScorePdf} · Pass ${passMarkPdf.toFixed(1)}</span>
    </div>

    ${scoredItems > 0 ? `
    <div class="verdict-banner">
      <div class="verdict-icon">${verdict.passed ? '✓' : '!'}</div>
      <div>
        <div class="verdict-label">${verdict.label}</div>
        <div class="verdict-detail">${escapeHtml(verdict.detail)}</div>
      </div>
    </div>` : ''}

    <div class="info-grid">
      <div class="info-item"><div class="info-label">Student Name</div><div class="info-value">${escapeHtml(profile.studentName || '—')}</div></div>
      <div class="info-item"><div class="info-label">Student ID</div><div class="info-value">${escapeHtml(profile.candidateId || '—')}</div></div>
      <div class="info-item"><div class="info-label">Current Grade</div><div class="info-value">${escapeHtml(profile.currentGrade)}</div></div>
      <div class="info-item"><div class="info-label">Target Grade</div><div class="info-value">${escapeHtml(profile.targetGrade)}</div></div>
      <div class="info-item"><div class="info-label">Examiners</div><div class="info-value">${escapeHtml(examinerNamesJoined || '—')}</div></div>
      <div class="info-item"><div class="info-label">Date</div><div class="info-value">${escapeHtml(profile.date || '—')}</div></div>
    </div>

    <div class="score-section">
      <div class="score-gauge">
        <div class="avg">${combinedAverage.toFixed(2)}<span> / ${maxScorePdf.toFixed(1)}</span></div>
        <div class="tier">
          <div class="tier-name">${tier.tier}</div>
          <div class="tier-range">Score range ${tier.min.toFixed(1)}–${tier.max.toFixed(1)}</div>
          <div style="font-size:11px;opacity:0.7;margin-top:4px;">${scoredItems}/${totalItems} items scored</div>
        </div>
      </div>

      ${profile.examiners.length > 0 ? `
      <table class="examiner-table">
        <thead><tr><th>Examiner</th><th style="text-align:center;">Average</th></tr></thead>
        <tbody>${examinerRows}</tbody>
      </table>` : ''}

      <div class="advice">
        <div class="advice-label">Combined Training Advice</div>
        <div class="advice-text">${escapeHtml(tier.advice)}</div>
      </div>

      <div class="section-title">Combined Module Scores</div>
      ${moduleRows}
    </div>

    <div class="footer">
      Generated on ${new Date().toLocaleDateString()} — Martial Arts Grading & Assessment System
    </div>
  </div>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`);
  win.document.close();
}

function scoreColor(s: number): string {
  return ['', '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#059669'][s] ?? '#94a3b8';
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
