import { supabase } from '@/lib/supabase';

export type CalendarStatus = {
  connected: boolean;
  email?: string | null;
  lastSyncedAt?: string | null;
  lastError?: string | null;
};

const ENDPOINT = '/.netlify/functions/google-calendar';

export async function calendarRequest<T = Record<string, unknown>>(
  action: 'status' | 'auth-url' | 'sync' | 'disconnect',
  clubId: string,
): Promise<T & { error?: string }> {
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
  const token = data.session?.access_token;
  if (!token) return { error: 'not_signed_in' } as T & { error: string };
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, clubId }),
    });
    return (await response.json()) as T & { error?: string };
  } catch {
    return { error: 'unreachable' } as T & { error: string };
  }
}

// Fire-and-forget push after plans change; does nothing if Google isn't connected.
export const autoSyncCalendar = (clubId: string) => {
  void calendarRequest('sync', clubId);
};
