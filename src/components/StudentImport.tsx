import { useState, useRef } from 'react';
import { Upload, Link2, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2, Download, X } from 'lucide-react';
import { parseStudentsCSV, googleSheetsURLToCSV, generateSampleStudentsCSV, type ParsedStudent } from '@/lib/csvUtils';

type Props = {
  onImport: (students: ParsedStudent[]) => Promise<void>;
};

type Status = 'idle' | 'parsing' | 'fetching' | 'preview' | 'importing' | 'import-error' | 'error' | 'success';

export default function StudentImport({ onImport }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [preview, setPreview] = useState<ParsedStudent[]>([]);
  const [sheetUrl, setSheetUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setStatus('parsing');
    setErrorMsg('');
    try {
      const text = await file.text();
      const students = parseStudentsCSV(text);
      if (students.length === 0) {
        setStatus('error');
        setErrorMsg('No valid students found in the file. Make sure it has a header row with at least "Student Name" and "Student ID" columns.');
        return;
      }
      setPreview(students);
      setStatus('preview');
    } catch {
      setStatus('error');
      setErrorMsg('Could not read the file. Please ensure it is a valid CSV file.');
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleGoogleSheet = async () => {
    if (!sheetUrl.trim()) return;
    setStatus('fetching');
    setErrorMsg('');
    try {
      const csvUrl = googleSheetsURLToCSV(sheetUrl.trim());
      if (!csvUrl) {
        setStatus('error');
        setErrorMsg('That does not look like a Google Sheets URL. Paste the full sharing link (e.g. https://docs.google.com/spreadsheets/d/.../edit).');
        return;
      }
      const resp = await fetch(csvUrl);
      if (!resp.ok) {
        setStatus('error');
        setErrorMsg('Could not fetch the sheet. Make sure the sharing permission is set to "Anyone with the link can view".');
        return;
      }
      const text = await resp.text();
      const students = parseStudentsCSV(text);
      if (students.length === 0) {
        setStatus('error');
        setErrorMsg('No valid students found in the sheet. Make sure the first row has headers like "Student Name" and "Student ID".');
        return;
      }
      setPreview(students);
      setStatus('preview');
    } catch {
      setStatus('error');
      setErrorMsg('Failed to fetch the Google Sheet. Check the URL and sharing permissions, then try again.');
    }
  };

  const handleConfirmImport = async () => {
    setStatus('importing');
    setErrorMsg('');
    try {
      await onImport(preview);
      setPreview([]);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (error) {
      setStatus('import-error');
      setErrorMsg(error instanceof Error ? error.message : 'Could not import students. Please try again.');
    }
  };

  const handleCancelPreview = () => {
    setPreview([]);
    setStatus('idle');
  };

  const handleDownloadSample = () => {
    const blob = new Blob([generateSampleStudentsCSV()], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setStatus('idle');
    setErrorMsg('');
    setPreview([]);
    setSheetUrl('');
    setShowUrlInput(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
        <Upload size={18} className="text-amber-600" />
        <h3 className="text-sm font-bold text-slate-900">Import Students</h3>
      </div>

      <div className="p-5">
        {status === 'success' ? (
          <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3">
            <CheckCircle2 size={20} className="text-emerald-600" />
            <p className="text-sm font-semibold text-emerald-800">
              Students imported successfully!
            </p>
          </div>
        ) : status === 'preview' || status === 'importing' || status === 'import-error' ? (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">
                Preview ({preview.length} student{preview.length !== 1 ? 's' : ''})
              </p>
              <button
                onClick={handleCancelPreview}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mb-4 max-h-56 overflow-y-auto rounded-xl border border-slate-100">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="text-left text-slate-500">
                    <th className="px-3 py-2 font-semibold">Name</th>
                    <th className="px-3 py-2 font-semibold">Student ID</th>
                    <th className="px-3 py-2 font-semibold">Grade</th>
                    <th className="px-3 py-2 font-semibold">Target</th>
                    <th className="px-3 py-2 font-semibold">Examiner</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {preview.map((student, i) => (
                    <tr key={i} className="text-slate-700">
                      <td className="px-3 py-2 font-medium">{student.student_name}</td>
                      <td className="px-3 py-2 font-mono text-slate-500">{student.candidate_id}</td>
                      <td className="px-3 py-2">{student.current_rank}</td>
                      <td className="px-3 py-2">{student.target_rank}</td>
                      <td className="px-3 py-2">{student.examiner_name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleConfirmImport}
                disabled={status === 'importing'}
                className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status === 'importing'
                  ? 'Importing...'
                  : `Import ${preview.length} Student${preview.length !== 1 ? 's' : ''}`}
              </button>
              <button
                onClick={handleCancelPreview}
                disabled={status === 'importing'}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
            {status === 'import-error' && (
              <div role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3">
                <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
                <p className="text-sm text-red-700">{errorMsg}</p>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Upload area */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 transition hover:border-amber-400 hover:bg-amber-50/30"
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileInput}
                className="hidden"
              />
              {status === 'parsing' ? (
                <>
                  <Loader2 size={24} className="mb-2 animate-spin text-amber-500" />
                  <p className="text-sm text-slate-500">Parsing file...</p>
                </>
              ) : (
                <>
                  <Upload size={24} className="mb-2 text-slate-400" />
                  <p className="text-sm font-medium text-slate-600">
                    Drop a CSV file here or click to browse
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Columns: Student Name, Student ID, Current Grade, Target Grade, Examiner, Notes
                  </p>
                </>
              )}
            </div>

            {/* Google Sheets link */}
            <div className="mt-4">
              {!showUrlInput ? (
                <button
                  onClick={() => setShowUrlInput(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <Link2 size={16} /> Import from Google Sheets
                </button>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <FileSpreadsheet size={14} /> Paste a public Google Sheets link
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none placeholder:text-slate-400"
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleGoogleSheet()}
                    />
                    <button
                      onClick={handleGoogleSheet}
                      disabled={status === 'fetching' || !sheetUrl.trim()}
                      className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {status === 'fetching' ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        'Fetch'
                      )}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    The sheet must be shared as "Anyone with the link can view".
                  </p>
                </div>
              )}
            </div>

            {/* Error */}
            {status === 'error' && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3">
                <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
                <div className="flex-1">
                  <p className="text-sm text-red-700">{errorMsg}</p>
                  <button
                    onClick={reset}
                    className="mt-2 text-xs font-semibold text-red-600 underline"
                  >
                    Try again
                  </button>
                </div>
              </div>
            )}

            {/* Sample download */}
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
              <p className="text-xs text-slate-400">Not sure about the format?</p>
              <button
                onClick={handleDownloadSample}
                className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 transition hover:text-amber-700"
              >
                <Download size={14} /> Download template
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
