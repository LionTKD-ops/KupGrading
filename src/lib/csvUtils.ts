import { GRADES } from '@/data/rubrics';

export type ParsedCandidate = {
  student_name: string;
  candidate_id: string;
  current_rank: string;
  target_rank: string;
  examiner_name: string | null;
  notes: string | null;
};

// Map various header name variations to canonical field keys
const headerAliases: Record<string, keyof ParsedCandidate> = {
  student_name: 'student_name',
  name: 'student_name',
  'student name': 'student_name',
  fullname: 'student_name',
  'full name': 'student_name',
  candidate_id: 'candidate_id',
  'candidate id': 'candidate_id',
  id: 'candidate_id',
  'student id': 'candidate_id',
  registration: 'candidate_id',
  current_rank: 'current_rank',
  'current rank': 'current_rank',
  'current grade': 'current_rank',
  rank: 'current_rank',
  grade: 'current_rank',
  belt: 'current_rank',
  target_rank: 'target_rank',
  'target rank': 'target_rank',
  'target grade': 'target_rank',
  'grading rank': 'target_rank',
  'grading grade': 'target_rank',
  'testing for': 'target_rank',
  examiner_name: 'examiner_name',
  'examiner name': 'examiner_name',
  examiner: 'examiner_name',
  notes: 'notes',
  note: 'notes',
  comments: 'notes',
};

const gradeKeys = GRADES.map((r) => r.key.toLowerCase());
const gradeLabels = GRADES.map((r) => r.label.toLowerCase());

function normalizeGrade(value: string): string {
  const lower = value.trim().toLowerCase();
  // Exact key match
  const exactKey = GRADES.find((r) => r.key.toLowerCase() === lower);
  if (exactKey) return exactKey.key;
  // Exact label match
  const exactLabel = GRADES.find((r) => r.label.toLowerCase() === lower);
  if (exactLabel) return exactLabel.key;
  // Partial match
  const partial = GRADES.find(
    (r) =>
      r.key.toLowerCase().includes(lower) ||
      r.label.toLowerCase().includes(lower) ||
      lower.includes(r.key.toLowerCase()),
  );
  if (partial) return partial.key;
  return value.trim();
}

function inferTargetGrade(currentGrade: string): string {
  const info = GRADES.find((r) => r.key === currentGrade);
  if (!info) return GRADES[0]?.key ?? '10-9 KUP';
  const higher = GRADES.filter((r) => r.maxScore > info.maxScore);
  return higher[0]?.key ?? currentGrade;
}

function parseCSV(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    if (inQuotes) {
      if (char === '"') {
        if (csvText[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field.trim());
      field = '';
    } else if (char === '\n' || char === '\r') {
      row.push(field.trim());
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      field = '';
      if (char === '\r' && csvText[i + 1] === '\n') i++;
    } else {
      field += char;
    }
  }

  row.push(field.trim());
  if (row.some((value) => value !== '')) rows.push(row);
  return rows;
}

export function parseCandidatesCSV(csvText: string): ParsedCandidate[] {
  const rows = parseCSV(csvText);
  if (rows.length < 2) return [];

  const headerFields = rows[0].map((h) => h.replace(/^\uFEFF/, '').toLowerCase());
  const colMap: Record<number, keyof ParsedCandidate> = {};

  headerFields.forEach((header, idx) => {
    const canonical = headerAliases[header];
    if (canonical) {
      colMap[idx] = canonical;
    }
  });

  const hasNameHeader = Object.values(colMap).includes('student_name');
  const hasIdHeader = Object.values(colMap).includes('candidate_id');

  const candidates: ParsedCandidate[] = [];

  for (let i = 1; i < rows.length; i++) {
    const fields = rows[i];

    let candidate: ParsedCandidate;

    if (hasNameHeader || hasIdHeader) {
      // Header-based mapping
      candidate = {
        student_name: '',
        candidate_id: '',
        current_rank: '10-9 KUP',
        target_rank: '',
        examiner_name: null,
        notes: null,
      };
      fields.forEach((value, idx) => {
        const key = colMap[idx];
        if (!key) return;
        if (key === 'current_rank') {
          candidate[key] = normalizeGrade(value);
        } else if (key === 'target_rank') {
          candidate[key] = value ? normalizeGrade(value) : '';
        } else if (key === 'examiner_name' || key === 'notes') {
          candidate[key] = value || null;
        } else {
          candidate[key] = value;
        }
      });
    } else {
      // Positional fallback: Name, ID, CurrentGrade, TargetGrade, Examiner, Notes
      candidate = {
        student_name: fields[0] || '',
        candidate_id: fields[1] || '',
        current_rank: normalizeGrade(fields[2] || '10-9 KUP'),
        target_rank: fields[3] ? normalizeGrade(fields[3]) : '',
        examiner_name: fields[4] || null,
        notes: fields[5] || null,
      };
    }

    if (!candidate.student_name && !candidate.candidate_id) continue;
    if (!candidate.student_name) candidate.student_name = `Candidate ${candidate.candidate_id}`;
    if (!candidate.candidate_id) candidate.candidate_id = `CAND-${Date.now()}-${i}`;
    if (!candidate.current_rank) candidate.current_rank = '10-9 KUP';
    if (!candidate.target_rank) candidate.target_rank = inferTargetGrade(candidate.current_rank);

    candidates.push(candidate);
  }

  return candidates;
}

// Convert a Google Sheets sharing URL to a CSV export URL
// Handles formats like:
//   https://docs.google.com/spreadsheets/d/FILE_ID/edit#gid=0
//   https://docs.google.com/spreadsheets/d/FILE_ID/edit?usp=sharing
export function googleSheetsURLToCSV(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) return null;
  const fileId = match[1];
  const gidMatch = url.match(/[?&#]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : '0';
  return `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv&gid=${gid}`;
}

export function isGradeValid(grade: string): boolean {
  return gradeKeys.includes(grade.toLowerCase()) || gradeLabels.includes(grade.toLowerCase());
}

export function generateSampleCSV(): string {
  const headers = 'Student Name,Candidate ID,Current Grade,Target Grade,Examiner Name,Notes';
  const rows = [
    'Jane Doe,TKD-2026-001,10-9 KUP,8-7 KUP,Master Kim,',
    'John Smith,TKD-2026-002,8-7 KUP,6-5 KUP,Master Kim,Focus on stances',
    'Alex Chen,TKD-2026-003,6-5 KUP,4-3 KUP,Master Lee,Promising talent',
  ];
  return [headers, ...rows].join('\n');
}
