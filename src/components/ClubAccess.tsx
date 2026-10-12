import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { LogIn, Loader2, ShieldCheck, Store } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import AdminPanel from '@/components/AdminPanel';
import StudentPortal, { type PortalEntry } from '@/components/StudentPortal';

export type Club = {
  id: string;
  name: string;
  join_code: string;
};

type Props = {
  children: (club: Club) => ReactNode;
};

type Screen = 'login' | 'signup' | 'join' | 'student';

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20';

export default function ClubAccess({ children }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [club, setClub] = useState<Club | null>(null);
  const [screen, setScreen] = useState<Screen>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [clubName, setClubName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [portal, setPortal] = useState<PortalEntry[] | null>(null);
  const [recovery, setRecovery] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    const { data: listener } = client.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(nextSession);
      setClub(null);
      setRefresh((value) => value + 1);
    });
    client.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) setError(sessionError.message);
      setSession(data.session);
      setBusy(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session) {
      setClub(null);
      setIsAdmin(false);
      setBusy(false);
      return;
    }

    let cancelled = false;
    const client = supabase;
    setBusy(true);
    setError('');

    const resolveClub = async () => {
      const { data: adminClaim } = await client.rpc('claim_super_admin');
      if (adminClaim === true) {
        if (!cancelled) setIsAdmin(true);
        return;
      }
      if (!cancelled) setIsAdmin(false);
      if (!cancelled) setPortal(null);

      const { data: initialMembership, error: membershipError } = await client
        .from('club_memberships')
        .select('club_id')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (membershipError) throw membershipError;
      let membership = initialMembership;

      if (!membership) {
        const metadata = session.user.user_metadata;
        const action = metadata.pending_club_action;
        let provisionError: { message: string } | null = null;
        if (action === 'create' && typeof metadata.pending_club_name === 'string') {
          const { error: rpcError } = await client.rpc('create_club', {
            p_name: metadata.pending_club_name,
          });
          provisionError = rpcError;
        } else if (action === 'join' && typeof metadata.pending_club_code === 'string') {
          const { error: rpcError } = await client.rpc('join_club', {
            p_join_code: metadata.pending_club_code,
          });
          provisionError = rpcError;
        }
        if (provisionError) throw provisionError;
        if (action === 'create' || action === 'join') {
          const { error: metadataError } = await client.auth.updateUser({
            data: {
              pending_club_action: null,
              pending_club_name: null,
              pending_club_code: null,
            },
          });
          if (metadataError) throw metadataError;
        }
        const { data: refreshedMembership, error: refreshedError } = await client
          .from('club_memberships')
          .select('club_id')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (refreshedError) throw refreshedError;
        membership = refreshedMembership;
      }

      if (!membership) {
        const { data: portalData } = await client.rpc('my_student_portal');
        if (!cancelled && Array.isArray(portalData) && portalData.length > 0) setPortal(portalData as PortalEntry[]);
        return;
      }
      const { data: clubData, error: clubError } = await client
        .from('clubs')
        .select('id, name, join_code')
        .eq('id', membership.club_id)
        .single();
      if (clubError) throw clubError;
      if (!cancelled) setClub(clubData as Club);
    };

    resolveClub()
      .catch((loadError: Error) => {
        if (!cancelled) setError(loadError.message);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session, refresh]);

  const handleAuth = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError('');
    setMessage('');

    if (screen === 'login') {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) setError(authError.message);
    } else if (screen === 'student') {
      const { data, error: authError } = await supabase.auth.signUp({ email, password });
      if (authError) {
        setError(authError.message);
      } else if (!data.session) {
        setMessage('Check your email to confirm your account, then sign in. Use the email address held on your student record.');
      }
    } else {
      const pending_club_action = screen === 'signup' ? 'create' : 'join';
      const metadata = screen === 'signup'
        ? { pending_club_action, pending_club_name: clubName.trim() }
        : { pending_club_action, pending_club_code: joinCode.trim().toUpperCase() };
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: metadata },
      });
      if (authError) {
        setError(authError.message);
      } else if (!data.session) {
        setMessage('Check your email to confirm your account, then sign in to finish setting up club access.');
      } else {
        setMessage('Account created. Setting up your club access…');
      }
    }
    setBusy(false);
  };

  const handleJoinClub = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !session) return;
    setBusy(true);
    setError('');
    const setupError = screen === 'signup'
      ? (await supabase.rpc('create_club', { p_name: clubName.trim() })).error
      : (await supabase.rpc('join_club', { p_join_code: joinCode.trim().toUpperCase() })).error;
    if (setupError) {
      setError(setupError.message);
      setBusy(false);
      return;
    }
    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        pending_club_action: null,
        pending_club_name: null,
        pending_club_code: null,
      },
    });
    if (metadataError) {
      setError(metadataError.message);
      setBusy(false);
      return;
    }
    setRefresh((value) => value + 1);
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(signOutError.message);
  };

  const handleForgotPassword = async () => {
    if (!supabase) return;
    if (!email.trim()) {
      setError('Enter your email address first.');
      return;
    }
    setBusy(true);
    setError('');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    if (resetError) setError(resetError.message);
    else setMessage('If that account exists, a link to set your password has been emailed.');
    setBusy(false);
  };

  const handleSetPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError('');
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      setError(updateError.message);
    } else {
      setNewPassword('');
      setRecovery(false);
      setMessage('Password saved.');
    }
    setBusy(false);
  };

  if (!supabase) return null;
  if (recovery && session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
        <form onSubmit={handleSetPassword} className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-7 shadow-xl">
          <h1 className="text-lg font-bold text-slate-900">Set your password</h1>
          <input className={inputClass} type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password (at least 8 characters)" required />
          <button disabled={busy} className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60">
            Save password
          </button>
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </form>
      </main>
    );
  }
  if (session && isAdmin && !busy) return <AdminPanel email={session.user.email ?? ''} onSignOut={handleSignOut} />;
  if (club) return <>{children(club)}</>;
  if (session && portal && !busy) return <StudentPortal entries={portal} email={session.user.email ?? ''} onSignOut={handleSignOut} />;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-amber-50/30 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-red-600 text-white">
            <Store size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Club Grading Portal</h1>
            <p className="text-sm text-slate-500">Sign in to access your club records</p>
          </div>
        </div>

        {busy ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-amber-500" /></div>
        ) : session && !club ? (
          <form onSubmit={handleJoinClub} className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {(['signup', 'join'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => { setScreen(option); setError(''); }}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold ${screen === option ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  {option === 'signup' ? 'Create a club' : 'Join a club'}
                </button>
              ))}
            </div>
            {screen === 'signup' ? (
              <input className={inputClass} value={clubName} onChange={(event) => setClubName(event.target.value)} placeholder="Club name" required />
            ) : (
              <>
                <p className="text-sm text-slate-600">Enter your club’s join code to access its student records.</p>
                <input className={inputClass} value={joinCode} onChange={(event) => setJoinCode(event.target.value)} placeholder="Club join code" required />
              </>
            )}
            <button className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600">
              {screen === 'signup' ? 'Create club' : 'Join club'}
            </button>
            <button type="button" onClick={handleSignOut} className="w-full text-sm text-slate-500 hover:text-slate-800">
              Sign out
            </button>
          </form>
        ) : (
          <>
            <div className="mb-5 grid grid-cols-4 gap-2">
              {(['login', 'signup', 'join', 'student'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => { setScreen(option); setError(''); setMessage(''); }}
                  className={`rounded-lg px-2 py-2 text-xs font-semibold capitalize ${screen === option ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  {option === 'signup' ? 'Create club' : option === 'join' ? 'Join club' : option === 'student' ? 'Student' : 'Sign in'}
                </button>
              ))}
            </div>
            <form onSubmit={handleAuth} className="space-y-4">
              {screen === 'student' && (
                <p className="text-sm text-slate-600">Students and parents: use the email address your club holds on your student record to see your assessment countdown and feedback.</p>
              )}
              {screen === 'signup' && (
                <input className={inputClass} value={clubName} onChange={(event) => setClubName(event.target.value)} placeholder="Club name" required />
              )}
              {screen === 'join' && (
                <input className={inputClass} value={joinCode} onChange={(event) => setJoinCode(event.target.value)} placeholder="Club join code" required />
              )}
              <input className={inputClass} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" required />
              <input className={inputClass} type="password" autoComplete={screen === 'login' ? 'current-password' : 'new-password'} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password (at least 8 characters)" required />
              <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-red-600 px-4 py-2.5 text-sm font-semibold text-white">
                <LogIn size={16} /> {screen === 'login' ? 'Sign in' : screen === 'signup' ? 'Create club account' : screen === 'student' ? 'Create student account' : 'Create account and join'}
              </button>
              {screen === 'login' && (
                <button type="button" onClick={handleForgotPassword} className="w-full text-sm text-slate-500 hover:text-slate-800">
                  Set or reset password (emails you a link)
                </button>
              )}
            </form>
          </>
        )}

        {message && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex items-start gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
          <ShieldCheck size={16} className="shrink-0 text-emerald-600" />
          Student and grading records are restricted to authenticated members of your club.
        </div>
      </section>
    </main>
  );
}
