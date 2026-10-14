// Business: A signed-in admin or technician must stay signed in across the portal, and a stranger
// Business: who types a dashboard URL directly gets bounced to the right login instead of a blank page.
// Technical: The Worker issues an opaque session token; the browser keeps it in localStorage (staff
// devices are trusted, and this is pre-OAuth). This module is the ONLY place that touches that storage,
// so a page never hand-rolls a key name and silently reads a stale token.

export type SessionRole = 'admin' | 'technician';

const TOKEN_KEY = 'sl.token';
const ROLE_KEY = 'sl.role';
// Business: Supabase hands back a refresh token alongside the short-lived access token; keeping it lets a
// Business: silent refresh extend a session instead of bouncing a working staff member back to the login page.
const REFRESH_KEY = 'sl.refresh';

const LOGIN_PATH: Record<SessionRole, string> = {
  admin: '/admin/login',
  technician: '/tech/login',
};

export function getToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getRole(): SessionRole | null {
  if (typeof localStorage === 'undefined') return null;
  const stored = localStorage.getItem(ROLE_KEY);
  return stored === 'admin' || stored === 'technician' ? stored : null;
}

export function getRefreshToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(REFRESH_KEY);
}

// Business: Swap in a freshly refreshed token (and its new refresh token) without disturbing the stored role.
export function setAccessToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_KEY, token);
}

export function saveSession(token: string, role: SessionRole): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ROLE_KEY, role);
}

export function clearSession(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function loginPathFor(role: SessionRole): string {
  return LOGIN_PATH[role];
}

// Business: Every protected staff page calls this first. It returns the live session when the visitor
// Business: genuinely holds a token for THAT portal, and otherwise redirects them to sign in.
// Technical: Returning null (not throwing) lets the caller `return` early and skip all rendering. We
// replace() rather than assign() so the back button cannot drop a signed-out user onto a cached page.
export function requireSession(role: SessionRole): { token: string; role: SessionRole } | null {
  const token = getToken();
  const current = getRole();
  if (!token || current !== role) {
    clearSession();
    if (typeof window !== 'undefined') window.location.replace(LOGIN_PATH[role]);
    return null;
  }
  return { token, role: current };
}
