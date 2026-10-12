import { useState, type FormEvent } from 'react';
import { Plus, X } from 'lucide-react';
import {
  COACH_QUALIFICATIONS,
  supabase,
  type CoachQualification,
  type CoachQualificationType,
} from '@/lib/supabase';

type Props = {
  clubId: string;
  coachId: string;
  coachName: string;
  qualifications: CoachQualification[];
  onChanged: () => void;
  onError: (message: string) => void;
};

const labelFor = (value: CoachQualificationType) =>
  COACH_QUALIFICATIONS.find((item) => item.value === value)?.label ?? value;

export default function QualificationsCell({ clubId, coachId, coachName, qualifications, onChanged, onError }: Props) {
  const held = new Set(qualifications.map((item) => item.qualification));
  const available = COACH_QUALIFICATIONS.filter((item) => !held.has(item.value));
  const [selected, setSelected] = useState<CoachQualificationType | ''>('');
  const [date, setDate] = useState('');
  const today = new Date().toISOString().split('T')[0];
  const current = selected && available.some((item) => item.value === selected) ? selected : (available[0]?.value ?? '');

  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !current || !date) return;
    const { error } = await supabase.from('coach_qualifications').insert({
      club_id: clubId,
      coach_id: coachId,
      qualification: current,
      date_achieved: date,
    });
    if (error) {
      onError(error.message);
      return;
    }
    setSelected('');
    setDate('');
    onChanged();
  };

  const remove = async (item: CoachQualification) => {
    if (!supabase || !window.confirm(`Remove ${labelFor(item.qualification)} from ${coachName}?`)) return;
    const { error } = await supabase
      .from('coach_qualifications')
      .delete()
      .eq('id', item.id)
      .eq('club_id', clubId);
    if (error) onError(error.message);
    else onChanged();
  };

  return (
    <div className="space-y-2">
      {qualifications.length === 0 && <p className="text-xs text-slate-400">None recorded</p>}
      <ul className="space-y-1">
        {qualifications.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-xs text-slate-700">
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-800">
              {labelFor(item.qualification)}
            </span>
            <span className="text-slate-500">{item.date_achieved}</span>
            <button onClick={() => remove(item)} aria-label={`Remove ${labelFor(item.qualification)} from ${coachName}`} className="text-slate-400 hover:text-red-600">
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
      {available.length > 0 && (
        <form onSubmit={add} className="flex flex-wrap items-center gap-1.5">
          <select
            value={current}
            onChange={(e) => setSelected(e.target.value as CoachQualificationType)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
            aria-label={`Qualification to add for ${coachName}`}
          >
            {available.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <input
            type="date"
            max={today}
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
            aria-label={`Date achieved for ${coachName}`}
          />
          <button className="flex items-center gap-1 rounded-lg bg-slate-900 px-2 py-1 text-xs font-semibold text-white">
            <Plus size={12} /> Add qualification
          </button>
        </form>
      )}
    </div>
  );
}
