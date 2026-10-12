import { parseCSV } from '@/lib/csvUtils';
import { PLAN_SECTIONS, type PlanSection } from '@/lib/supabase';

export type PlanActivityInput = {
  section: PlanSection;
  timing: string;
  description: string;
  content_activity: string;
  coaching_points: string;
};

export type ParsedPlanSession = {
  session_date: string | null;
  session_time: string | null;
  title: string | null;
  activities: PlanActivityInput[];
};

const headerAliases: Record<string, string> = {
  date: 'date',
  'session date': 'date',
  time: 'time',
  'session time': 'time',
  'start time': 'time',
  title: 'title',
  'session title': 'title',
  'session name': 'title',
  section: 'section',
  timing: 'timing',
  timings: 'timing',
  duration: 'timing',
  'section description': 'description',
  description: 'description',
  'content activity': 'content',
  'content/activity': 'content',
  'content / activity': 'content',
  content: 'content',
  activity: 'content',
  'coaching points': 'coaching',
  'coaching points and physical preparations': 'coaching',
  'coaching points & physical preparations': 'coaching',
  'physical preparations': 'coaching',
};

export const SAMPLE_PLAN_CSV = [
  'Date,Time,Title,Section,Timing,Section Description,Content Activity,Coaching Points and Physical Preparations',
  '2026-10-19,18:00,Week 1 - Stances,Warm up,10 min,General warm up,Jogging and dynamic stretching,Raise heart rate; mobilise hips',
  '2026-10-19,,,Main content,40 min,Stance work,Walking stance and front stance drills,Keep back straight; knee over toes',
  '2026-10-19,,,Cool down,10 min,Cool down,Static stretching and feedback,Slow breathing',
  '2026-10-26,18:00,Week 2 - Kicks,Warm up,10 min,General warm up,Skipping and leg swings,',
  '2026-10-26,,,Main content,40 min,Front kick,Front kick on pads,Chamber the knee',
].join('\n');

const normaliseSection = (value: string): PlanSection => {
  const lower = value.trim().toLowerCase();
  if (lower.startsWith('warm')) return 'Warm up';
  if (lower.startsWith('cool')) return 'Cool down';
  return PLAN_SECTIONS.find((item) => item.toLowerCase() === lower) ?? 'Main content';
};

// Accepts YYYY-MM-DD or DD/MM/YYYY (UK) and returns ISO, or null if invalid.
export function normaliseDate(value: string): string | null {
  const text = value.trim();
  let year: number, month: number, day: number;
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    match = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
    if (!match) return null;
    day = Number(match[1]);
    month = Number(match[2]);
    year = Number(match[3]);
    if (year < 100) year += 2000;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().split('T')[0];
}

const normaliseTime = (value: string): string | null => {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
};

export function parsePlanCSV(text: string): { sessions: ParsedPlanSession[]; errors: string[] } {
  const rows = parseCSV(text);
  const errors: string[] = [];
  if (rows.length < 2) return { sessions: [], errors: ['The file needs a header row and at least one data row.'] };

  const columns: Record<string, number> = {};
  rows[0].forEach((header, index) => {
    const key = headerAliases[header.replace(/^\uFEFF/, '').trim().toLowerCase()];
    if (key && !(key in columns)) columns[key] = index;
  });
  if (!('content' in columns) && !('description' in columns)) {
    return { sessions: [], errors: ['Could not find "Section Description" or "Content Activity" columns.'] };
  }

  const cell = (row: string[], key: string) => (key in columns ? (row[columns[key]] ?? '').trim() : '');
  const sessions: ParsedPlanSession[] = [];
  let current: ParsedPlanSession | null = null;

  rows.slice(1).forEach((row, index) => {
    const line = index + 2;
    const rawDate = cell(row, 'date');
    if (rawDate) {
      const iso = normaliseDate(rawDate);
      if (!iso) errors.push(`Row ${line}: date "${rawDate}" is not valid (use YYYY-MM-DD or DD/MM/YYYY).`);
      if (!current || current.session_date !== iso) {
        current = { session_date: iso, session_time: null, title: null, activities: [] };
        sessions.push(current);
      }
    } else if (!current) {
      current = { session_date: null, session_time: null, title: null, activities: [] };
      sessions.push(current);
    }
    const target = current as ParsedPlanSession;
    const time = normaliseTime(cell(row, 'time'));
    if (time && !target.session_time) target.session_time = time;
    const title = cell(row, 'title');
    if (title && !target.title) target.title = title;

    const activity: PlanActivityInput = {
      section: normaliseSection(cell(row, 'section')),
      timing: cell(row, 'timing'),
      description: cell(row, 'description'),
      content_activity: cell(row, 'content'),
      coaching_points: cell(row, 'coaching'),
    };
    if (activity.timing || activity.description || activity.content_activity || activity.coaching_points) {
      target.activities.push(activity);
    }
  });

  return { sessions: sessions.filter((item) => item.activities.length > 0), errors };
}
