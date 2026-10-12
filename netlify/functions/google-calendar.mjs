import { createHmac, timingSafeEqual } from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const SITE_URL = (process.env.SITE_URL || process.env.URL || '').replace(/\/$/, '');
const TIME_ZONE = process.env.CALENDAR_TIME_ZONE || 'Europe/London';
const REDIRECT_URI = `${SITE_URL}/.netlify/functions/google-calendar`;
const SCOPES = 'openid email https://www.googleapis.com/auth/calendar.events';

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const sign = (payload) => createHmac('sha256', SERVICE_KEY).update(payload).digest('base64url');

const makeState = (userId, clubId) => {
  const payload = Buffer.from(JSON.stringify({ userId, clubId, exp: Date.now() + 10 * 60_000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
};

const readState = (state) => {
  const [payload, signature] = (state || '').split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
  return data.exp > Date.now() ? data : null;
};

const db = async (path, options = {}) => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation,resolution=merge-duplicates',
      ...options.headers,
    },
  });
  if (!response.ok) throw new Error(`Database error: ${await response.text()}`);
  return response.status === 204 ? null : response.json();
};

const getUser = async (request) => {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer /i, '');
  if (!token) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
  });
  return response.ok ? response.json() : null;
};

const isMember = async (userId, clubId) => {
  const rows = await db(`club_memberships?user_id=eq.${userId}&club_id=eq.${clubId}&select=club_id`);
  return rows.length > 0;
};

const googleToken = async (params) => {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...params }),
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error_description || data.error || 'Google token error');
    error.code = data.error;
    throw error;
  }
  return data;
};

const calendar = async (accessToken, path, options = {}) => {
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  });
  if (response.status === 204) return { status: 204, ok: true, body: {} };
  const body = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, body };
};

// Google event ids allow a-v and 0-9, so a UUID without dashes is valid and stable.
const eventId = (planId) => `kup${planId.replace(/-/g, '')}`;

const pad = (n) => String(n).padStart(2, '0');

const toLocal = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`;
};

const buildEvent = (plan, activities, clubName) => {
  const minutes = activities.reduce((sum, item) => sum + (parseInt(item.timing, 10) || 0), 0) || 60;
  const lines = [];
  if (plan.session_goals) lines.push(`Goals: ${plan.session_goals}`);
  activities.forEach((item) => {
    const detail = [item.description, item.content_activity].filter(Boolean).join(' - ');
    lines.push(`${item.section}${item.timing ? ` (${item.timing})` : ''}: ${detail}`);
  });
  const event = {
    id: eventId(plan.id),
    status: 'confirmed',
    summary: `${clubName}: ${plan.title}`,
    location: plan.venue || undefined,
    description: lines.join('\n') || undefined,
    extendedProperties: { private: { kupClub: plan.club_id, kupPlan: plan.id } },
  };
  const [y, mo, d] = plan.session_date.split('-').map(Number);
  if (plan.session_time) {
    const [h, m] = plan.session_time.split(':').map(Number);
    const start = Date.UTC(y, mo - 1, d, h, m);
    event.start = { dateTime: toLocal(start), timeZone: TIME_ZONE };
    event.end = { dateTime: toLocal(start + minutes * 60_000), timeZone: TIME_ZONE };
  } else {
    event.start = { date: plan.session_date };
    event.end = { date: toLocal(Date.UTC(y, mo - 1, d + 1)).slice(0, 10) };
  }
  return event;
};

const syncClub = async (link) => {
  const clubId = link.club_id;
  const { access_token: accessToken } = await googleToken({ grant_type: 'refresh_token', refresh_token: link.refresh_token });

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const [clubs, plans, activities] = await Promise.all([
    db(`clubs?id=eq.${clubId}&select=name`),
    db(`session_plans?club_id=eq.${clubId}&session_date=gte.${since}&select=*`),
    db(`session_plan_activities?club_id=eq.${clubId}&select=*&order=sort_order`),
  ]);
  const clubName = clubs[0]?.name ?? 'Club';
  const byPlan = {};
  activities.forEach((item) => (byPlan[item.session_plan_id] ??= []).push(item));

  let written = 0;
  for (let i = 0; i < plans.length; i += 5) {
    await Promise.all(
      plans.slice(i, i + 5).map(async (plan) => {
        const event = buildEvent(plan, byPlan[plan.id] ?? [], clubName);
        let result = await calendar(accessToken, 'events', { method: 'POST', body: JSON.stringify(event) });
        if (result.status === 409) {
          result = await calendar(accessToken, `events/${event.id}`, { method: 'PUT', body: JSON.stringify(event) });
        }
        if (!result.ok) throw new Error(result.body?.error?.message || `Google error ${result.status}`);
        written += 1;
      }),
    );
  }

  // Remove events for plans that were deleted in the app.
  const keep = new Set(plans.map((plan) => plan.id));
  const listed = await calendar(
    accessToken,
    `events?privateExtendedProperty=${encodeURIComponent(`kupClub=${clubId}`)}&timeMin=${encodeURIComponent(`${since}T00:00:00Z`)}&maxResults=2500`,
  );
  let removed = 0;
  for (const event of listed.body?.items ?? []) {
    const planId = event.extendedProperties?.private?.kupPlan;
    if (planId && !keep.has(planId)) {
      await calendar(accessToken, `events/${event.id}`, { method: 'DELETE' });
      removed += 1;
    }
  }

  await db(`google_calendar_links?club_id=eq.${clubId}`, {
    method: 'PATCH',
    body: JSON.stringify({ last_synced_at: new Date().toISOString(), last_sync_error: null }),
  });
  return { written, removed };
};

const handleCallback = async (url) => {
  const back = (flag) => Response.redirect(`${SITE_URL}/?gcal=${flag}`, 302);
  const state = readState(url.searchParams.get('state'));
  const code = url.searchParams.get('code');
  if (!state || !code) return back('error');
  try {
    const tokens = await googleToken({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI });
    if (!tokens.refresh_token) return back('no_refresh');
    const claims = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64url').toString());
    await db('google_calendar_links?on_conflict=club_id', {
      method: 'POST',
      body: JSON.stringify({
        club_id: state.clubId,
        connected_by: state.userId,
        google_email: claims.email ?? null,
        refresh_token: tokens.refresh_token,
        last_sync_error: null,
      }),
    });
    const [link] = await db(`google_calendar_links?club_id=eq.${state.clubId}&select=*`);
    await syncClub(link).catch(() => {});
    return back('connected');
  } catch {
    return back('error');
  }
};

export default async (request) => {
  if (!SUPABASE_URL || !SERVICE_KEY || !CLIENT_ID || !CLIENT_SECRET || !SITE_URL) {
    return json(503, { error: 'not_configured' });
  }
  const url = new URL(request.url);
  if (request.method === 'GET') return handleCallback(url);
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const user = await getUser(request);
  if (!user) return json(401, { error: 'not_signed_in' });
  const { action, clubId } = await request.json().catch(() => ({}));
  if (!clubId || !(await isMember(user.id, clubId))) return json(403, { error: 'not_a_member' });

  const [link] = await db(
    `google_calendar_links?club_id=eq.${clubId}&select=club_id,refresh_token,google_email,last_synced_at,last_sync_error,connected_by`,
  );

  if (action === 'status') {
    return json(200, {
      connected: Boolean(link),
      email: link?.google_email ?? null,
      lastSyncedAt: link?.last_synced_at ?? null,
      lastError: link?.last_sync_error ?? null,
    });
  }

  if (action === 'auth-url') {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      state: makeState(user.id, clubId),
    });
    return json(200, { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  }

  if (action === 'disconnect') {
    if (link) {
      await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: link.refresh_token }),
      }).catch(() => {});
      await db(`google_calendar_links?club_id=eq.${clubId}`, { method: 'DELETE' });
    }
    return json(200, { connected: false });
  }

  if (action === 'sync') {
    if (!link) return json(200, { connected: false });
    try {
      return json(200, { connected: true, ...(await syncClub({ ...link, club_id: clubId })) });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      if (error?.code === 'invalid_grant') {
        await db(`google_calendar_links?club_id=eq.${clubId}`, { method: 'DELETE' });
        return json(401, { error: 'reconnect_required' });
      }
      await db(`google_calendar_links?club_id=eq.${clubId}`, {
        method: 'PATCH',
        body: JSON.stringify({ last_sync_error: message.slice(0, 500) }),
      });
      return json(502, { error: message });
    }
  }

  return json(400, { error: 'unknown_action' });
};
