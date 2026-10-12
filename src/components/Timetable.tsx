import { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, ChevronLeft, ChevronRight, Download, RefreshCw } from 'lucide-react';
import type { SessionPlan, SessionPlanActivity } from '@/lib/supabase';
import { calendarRequest, type CalendarStatus } from '@/lib/googleCalendar';

type Props = {
  clubId: string;
  clubName: string;
  plans: SessionPlan[];
  activitiesByPlan: Record<string, SessionPlanActivity[]>;
  onOpenPlan: (plan: SessionPlan) => void;
};

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const startOfWeek = (date: Date) => {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7));
  return copy;
};

// Session length = sum of the numbers in the activity timings, 60 minutes if none.
const durationMinutes = (activities: SessionPlanActivity[] = []) => {
  const total = activities.reduce((sum, item) => sum + (parseInt(item.timing ?? '', 10) || 0), 0);
  return total > 0 ? total : 60;
};

const stamp = (date: string, time: string | null, addMinutes = 0) => {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time ?? '00:00').split(':').map(Number);
  const value = new Date(y, m - 1, d, hh, mm + addMinutes);
  return `${value.getFullYear()}${pad(value.getMonth() + 1)}${pad(value.getDate())}T${pad(value.getHours())}${pad(value.getMinutes())}00`;
};

const googleLink = (plan: SessionPlan, clubName: string, minutes: number) => {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${clubName}: ${plan.title}`,
    dates: `${stamp(plan.session_date, plan.session_time)}/${stamp(plan.session_date, plan.session_time, minutes)}`,
    details: plan.session_goals ?? '',
    location: plan.venue ?? '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

const icsEscape = (text: string) => text.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => `\\${c}`);

const calendarId = (value: string) => {
  const text = value.trim();
  const src = text.match(/[?&]src=([^&"]+)/);
  return src ? decodeURIComponent(src[1]) : text;
};

export default function Timetable({ clubId, clubName, plans, activitiesByPlan, onOpenPlan }: Props) {
  const storageKey = `google-calendar-${clubId}`;
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [savedCalendar, setSavedCalendar] = useState('');
  const [calendarInput, setCalendarInput] = useState('');
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [syncMessage, setSyncMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    calendarRequest<CalendarStatus>('status', clubId).then((result) => {
      if (!active) return;
      setStatus(result.error ? null : result);
    });
    return () => {
      active = false;
    };
  }, [clubId]);

  const connectGoogle = async () => {
    setBusy(true);
    const result = await calendarRequest<{ url: string }>('auth-url', clubId);
    if (result.url) window.location.href = result.url;
    else {
      setSyncMessage('Google sync is not configured on the server yet.');
      setBusy(false);
    }
  };

  const syncNow = async () => {
    setBusy(true);
    setSyncMessage('');
    const result = await calendarRequest<{ written: number; removed: number }>('sync', clubId);
    if (result.error) setSyncMessage(result.error === 'reconnect_required' ? 'Google access expired. Please reconnect.' : `Sync failed: ${result.error}`);
    else setSyncMessage(`Synced ${result.written} session(s) to Google Calendar.`);
    const refreshed = await calendarRequest<CalendarStatus>('status', clubId);
    setStatus(refreshed.error ? { connected: false } : refreshed);
    setBusy(false);
  };

  const disconnectGoogle = async () => {
    if (!window.confirm('Disconnect Google Calendar? Existing events stay in Google.')) return;
    setBusy(true);
    await calendarRequest('disconnect', clubId);
    setStatus({ connected: false });
    setBusy(false);
  };

  useEffect(() => {
    const stored = localStorage.getItem(storageKey) ?? '';
    setSavedCalendar(stored);
    setCalendarInput(stored);
  }, [storageKey]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)),
    [weekStart],
  );

  const shiftWeek = (weeks: number) =>
    setWeekStart((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() + weeks * 7));

  const saveCalendar = () => {
    const id = calendarId(calendarInput);
    if (id) localStorage.setItem(storageKey, id);
    else localStorage.removeItem(storageKey);
    setSavedCalendar(id);
    setCalendarInput(id);
  };

  const downloadIcs = () => {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//KupGrading//Session plans//EN'];
    plans.forEach((plan) => {
      const minutes = durationMinutes(activitiesByPlan[plan.id]);
      lines.push(
        'BEGIN:VEVENT',
        `UID:${plan.id}@kupgrading`,
        `DTSTAMP:${stamp(iso(new Date()), '00:00')}`,
        `DTSTART:${stamp(plan.session_date, plan.session_time)}`,
        `DTEND:${stamp(plan.session_date, plan.session_time, minutes)}`,
        `SUMMARY:${icsEscape(`${clubName}: ${plan.title}`)}`,
        `LOCATION:${icsEscape(plan.venue ?? '')}`,
        `DESCRIPTION:${icsEscape(plan.session_goals ?? '')}`,
        'END:VEVENT',
      );
    });
    lines.push('END:VCALENDAR');
    const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'session-plans.ics';
    link.click();
    URL.revokeObjectURL(url);
  };

  const todayIso = iso(new Date());
  const rangeLabel = `${days[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-slate-900">Timetable</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => shiftWeek(-1)} aria-label="Previous week" className="rounded-lg border border-slate-200 p-1.5"><ChevronLeft size={16} /></button>
          <span className="min-w-44 text-center text-sm font-medium text-slate-700">{rangeLabel}</span>
          <button onClick={() => shiftWeek(1)} aria-label="Next week" className="rounded-lg border border-slate-200 p-1.5"><ChevronRight size={16} /></button>
          <button onClick={() => setWeekStart(startOfWeek(new Date()))} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-600">Today</button>
          <button onClick={downloadIcs} disabled={plans.length === 0} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-50">
            <Download size={14} /> .ics
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-7">
        {days.map((day) => {
          const dayIso = iso(day);
          const daySessions = plans
            .filter((plan) => plan.session_date === dayIso)
            .sort((a, b) => (a.session_time ?? '').localeCompare(b.session_time ?? ''));
          return (
            <div key={dayIso} className={`min-h-24 rounded-lg border p-2 ${dayIso === todayIso ? 'border-amber-400 bg-amber-50' : 'border-slate-200'}`}>
              <p className="text-xs font-semibold text-slate-500">{day.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}</p>
              <div className="mt-1 space-y-1.5">
                {daySessions.map((plan) => {
                  const minutes = durationMinutes(activitiesByPlan[plan.id]);
                  return (
                    <div key={plan.id} className="rounded-md bg-slate-100 p-1.5 text-xs">
                      <button onClick={() => onOpenPlan(plan)} className="block w-full text-left font-semibold text-slate-900 hover:underline">
                        {plan.session_time ? `${plan.session_time.slice(0, 5)} ` : ''}{plan.title}
                      </button>
                      <span className="text-slate-500">{minutes} min{plan.venue ? ` · ${plan.venue}` : ''}</span>
                      <a href={googleLink(plan, clubName, minutes)} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 text-amber-700 hover:underline">
                        <CalendarPlus size={12} /> Add to Google
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 border-t border-slate-200 pt-4">
        <h3 className="text-sm font-semibold text-slate-900">Automatic Google Calendar sync</h3>
        {status === null ? (
          <p className="mt-1 text-xs text-slate-500">Automatic sync is not set up on this server yet (see README).</p>
        ) : status.connected ? (
          <div className="mt-2 space-y-2">
            <p className="text-sm text-slate-700">
              Connected to <span className="font-semibold">{status.email ?? 'Google'}</span>. Saved, imported and deleted session plans update that calendar automatically.
            </p>
            {status.lastSyncedAt && <p className="text-xs text-slate-500">Last synced {new Date(status.lastSyncedAt).toLocaleString('en-GB')}</p>}
            {status.lastError && <p className="text-xs text-red-600">Last error: {status.lastError}</p>}
            <div className="flex gap-2">
              <button onClick={syncNow} disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"><RefreshCw size={14} /> Sync now</button>
              <button onClick={disconnectGoogle} disabled={busy} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-50">Disconnect</button>
            </div>
          </div>
        ) : (
          <div className="mt-2">
            <p className="text-xs text-slate-500">Sign in with the club admin's Google account once. Session plans are then pushed to that account's calendar automatically.</p>
            <button onClick={connectGoogle} disabled={busy} className="mt-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Connect Google Calendar</button>
          </div>
        )}
        {syncMessage && <p className="mt-2 text-xs text-slate-600">{syncMessage}</p>}
      </div>

      <div className="mt-5 border-t border-slate-200 pt-4">
        <h3 className="text-sm font-semibold text-slate-900">Google Calendar</h3>
        <p className="mt-1 text-xs text-slate-500">
          Paste a Calendar ID (or the embed link) to show your club's Google Calendar here. In Google Calendar open
          Settings → your calendar → Integrate calendar, and make the calendar public or share it with viewers.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            className="min-w-64 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={calendarInput}
            onChange={(e) => setCalendarInput(e.target.value)}
            placeholder={status?.email ?? 'e.g. yourclub@gmail.com'}
            aria-label="Google Calendar ID"
          />
          <button onClick={saveCalendar} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">
            {savedCalendar ? 'Update' : 'Show calendar'}
          </button>
        </div>
        {savedCalendar && (
          <iframe
            title="Google Calendar"
            className="mt-3 h-[480px] w-full rounded-lg border border-slate-200"
            src={`https://calendar.google.com/calendar/embed?src=${encodeURIComponent(savedCalendar)}&ctz=Europe%2FLondon&mode=WEEK&showTitle=0`}
          />
        )}
      </div>
    </section>
  );
}
