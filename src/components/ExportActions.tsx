import { FileText, FileSpreadsheet, Save, CheckCircle2, Loader2 } from 'lucide-react';

type Props = {
  onExportPDF: () => void;
  onExportCSV: () => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  canSave: boolean;
};

export default function ExportActions({
  onExportPDF,
  onExportCSV,
  onSave,
  saving,
  saved,
  canSave,
}: Props) {
  return (
    <div className="flex flex-wrap gap-3">
      <button
        onClick={onExportPDF}
        disabled={!canSave}
        className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <FileText size={18} /> Export PDF
      </button>
      <button
        onClick={onExportCSV}
        disabled={!canSave}
        className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <FileSpreadsheet size={18} /> Export CSV
      </button>
      <button
        onClick={onSave}
        disabled={!canSave || saving}
        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? (
          <>
            <Loader2 size={18} className="animate-spin" /> Saving...
          </>
        ) : saved ? (
          <>
            <CheckCircle2 size={18} /> Saved
          </>
        ) : (
          <>
            <Save size={18} /> Save Evaluation
          </>
        )}
      </button>
    </div>
  );
}
