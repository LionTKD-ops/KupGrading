import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type AdminClub = {
  id: string;
  name: string;
  join_code: string;
  created_at: string;
  member_count: number;
  student_count: number;
};

type Props = {
  email: string;
  onSignOut: () => void;
};

export default function AdminPanel({ email, onSignOut }: Props) {
  const [clubs, setClubs] = useState<AdminClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError('');
    const { data, error: loadError } = await supabase.rpc('admin_list_clubs');
    if (loadError) setError(loadError.message);
    else setClubs((data ?? []) as AdminClub[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetCode = async (club: AdminClub) => {
    if (!supabase || !window.confirm(`Reset the join code for ${club.name}? The old code stops working.`)) return;
    const { error: rpcError } = await supabase.rpc('admin_reset_join_code', { p_club_id: club.id });
    if (rpcError) setError(rpcError.message);
    else load();
  };

  const deleteClub = async (club: AdminClub) => {
    if (!supabase) return;
    const typed = window.prompt(`This permanently deletes ${club.name}, its members and all ${club.student_count} students and their grading data. Type the club name to confirm.`);
    if (typed !== club.name) return;
    const { error: rpcError } = await supabase.rpc('admin_delete_club', { p_club_id: club.id });
    if (rpcError) setError(rpcError.message);
    else load();
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-emerald-600" />
            <div>
              <h1 className="text-lg font-bold text-slate-900">Super admin</h1>
              <p className="text-sm text-slate-500">{email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200">
              <RefreshCw size={14} /> Refresh
            </button>
            <button onClick={onSignOut} className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">Sign out</button>
          </div>
        </header>

        {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-amber-500" /></div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Club</th>
                  <th className="px-4 py-3">Members</th>
                  <th className="px-4 py-3">Students</th>
                  <th className="px-4 py-3">Join code</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {clubs.map((club) => (
                  <tr key={club.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{club.name}</td>
                    <td className="px-4 py-3">{club.member_count}</td>
                    <td className="px-4 py-3">{club.student_count}</td>
                    <td className="px-4 py-3 font-mono text-xs">{club.join_code}</td>
                    <td className="px-4 py-3">{new Date(club.created_at).toLocaleDateString()}</td>
                    <td className="space-x-3 px-4 py-3 text-right">
                      <button onClick={() => resetCode(club)} className="text-amber-700 hover:underline">Reset code</button>
                      <button onClick={() => deleteClub(club)} aria-label={`Delete ${club.name}`} className="inline-flex align-middle text-red-600"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
                {clubs.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No clubs yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
