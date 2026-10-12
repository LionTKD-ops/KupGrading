import { GRADES } from '@/data/rubrics';
import { isUnder16, type StudentInput } from '@/lib/supabase';

export type ParsedStudent = StudentInput;

export type StudentImportResult = {
  students: ParsedStudent[];
  errors: string[];
};

const headerAliases: Record<string, keyof ParsedStudent> = {
  name: 'student_name',
  'student name': 'student_name',
  student_name: 'student_name',
  fullname: 'student_name',
  'full name': 'student_name',
  email: 'email',
  'email address': 'email',
  'e-mail': 'email',
  phone: 'phone',
  telephone: 'phone',
  mobile: 'phone',
  'phone number': 'phone',
  "guardian's name": 'guardian_name',
  'guardians name': 'guardian_name',
  'guardian name': 'guardian_name',
  guardian: 'guardian_name',
  parent: 'guardian_name',
  dob: 'date_of_birth',
  'date of birth': 'date_of_birth',
  birthday: 'date_of_birth',
  'current grade': 'current_rank',
  current_rank: 'current_rank',
  'current rank': 'current_rank',
  grade: 'current_rank',
  rank: 'current_rank',
  belt: 'current_rank',
  'date of last grading': 'last_grading_date',
  'last grading': 'last_grading_date',
  'last grading date': 'last_grading_date',
  'bt membership number': 'bt_membership_number',
  'bt membership no': 'bt_membership_number',
  'membership number': 'bt_membership_number',
  'bt number': 'bt_membership_number',
  'membership expiry': 'membership_expiry',
  'membership expiry date': 'membership_expiry',
  expiry: 'membership_expiry',
  'belt size': 'belt_size',
};

export const gradeKeys = GRADES.map((r) => r.key.toLowerCase());
const gradeLabels = GRADES.map((r) => r.label.toLowerCase());

export function normalizeGrade(value: string): string {
  const lower = value.trim().toLowerCase();
  const exact = GRADES.find((r) => r.key.toLowerCase() === lower || r.label.toLowerCase() === lower);
  if (exact) return exact.key;
  const partial = GRADES.find(
    (r) =>
      lower !== '' &&
      (r.key.toLowerCase().includes(lower) || r.label.toLowerCase().includes(lower) || lower.includes(r.key.toLowerCase())),
  );
  return partial ? partial.key : value.trim();
}

export function parseCSV(csvText: string): string[][] {
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

export const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

// Shared by the form and the CSV import. Returns a message when the record is invalid.
export function validateStudent(student: ParsedStudent): string | null {
  if (!student.student_name.trim()) return 'Name is required';
  if (!student.email || !isValidEmail(student.email)) return 'A valid email is required';
  if (!student.current_rank) return 'Current grade is required';
  if (isUnder16(student.date_of_birth) && !student.guardian_name?.trim()) {
    return "Guardian's name is required for students under 16";
  }
  return null;
}

export function parseStudentsCSV(csvText: string): StudentImportResult {
  const rows = parseCSV(csvText);
  const errors: string[] = [];
  if (rows.length < 2) return { students: [], errors: ['The file needs a header row and at least one student.'] };

  const columns: Partial<Record<keyof ParsedStudent, number>> = {};
  rows[0].forEach((header, index) => {
    const key = headerAliases[header.replace(/^\uFEFF/, '').trim().toLowerCase()];
    if (key && !(key in columns)) columns[key] = index;
  });
  if (columns.student_name === undefined || columns.email === undefined) {
    return { students: [], errors: ['The header row needs at least "Name" and "Email" columns.'] };
  }

  const text = (row: string[], key: keyof ParsedStudent) => {
    const index = columns[key];
    return index === undefined ? '' : (row[index] ?? '').trim();
  };
  const students: ParsedStudent[] = [];
  const seen = new Set<string>();

  rows.slice(1).forEach((row, index) => {
    const line = index + 2;
    const dateField = (key: keyof ParsedStudent): string | null => {
      const raw = text(row, key);
      if (!raw) return null;
      const iso = normaliseDate(raw);
      if (!iso) errors.push(`Row ${line}: "${raw}" is not a valid date (use YYYY-MM-DD or DD/MM/YYYY).`);
      return iso;
    };
    const student: ParsedStudent = {
      student_name: text(row, 'student_name'),
      email: text(row, 'email').toLowerCase(),
      phone: text(row, 'phone') || null,
      guardian_name: text(row, 'guardian_name') || null,
      date_of_birth: dateField('date_of_birth'),
      current_rank: normalizeGrade(text(row, 'current_rank') || GRADES[0].key),
      last_grading_date: dateField('last_grading_date'),
      bt_membership_number: text(row, 'bt_membership_number') || null,
      membership_expiry: dateField('membership_expiry'),
      belt_size: text(row, 'belt_size') || null,
    };

    const problem = validateStudent(student);
    if (problem) {
      errors.push(`Row ${line}: ${problem}.`);
      return;
    }
    if (!gradeKeys.includes(student.current_rank.toLowerCase())) {
      errors.push(`Row ${line}: grade "${student.current_rank}" is not recognised.`);
      return;
    }
    if (seen.has(student.email!)) {
      errors.push(`Row ${line}: email ${student.email} appears more than once in the file.`);
      return;
    }
    seen.add(student.email!);
    students.push(student);
  });

  return { students, errors };
}

// Convert a Google Sheets sharing URL to a CSV export URL
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

export function generateSampleStudentsCSV(): string {
  const headers =
    "Name,Email,Phone,Guardian's Name,DOB,Current Grade,Date of Last Grading,BT Membership Number,Membership Expiry,Belt Size";
  const rows = [
    'Jane Doe,jane@example.com,07700900001,,1990-04-12,10-9 KUP,2026-03-01,BT123456,2027-03-31,260',
    'John Smith,john@example.com,07700900002,Sam Smith,2014-09-30,8-7 KUP,2026-06-14,BT123457,2027-03-31,240',
  ];
  return [headers, ...rows].join('\n');
}
