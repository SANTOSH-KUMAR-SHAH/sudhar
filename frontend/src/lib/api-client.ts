// Business: The website talks to one backend base URL, never hardcoded fetches scattered across pages.
// Business: When no backend is configured it fails a clear way so a screen can fall back to demo mode.
// Technical: Thin fetch wrapper. Shapes below MIRROR the real API (a bare record / array, statuses from
// the shared vocabulary) — the earlier {data:{id}} guess never existed server-side, so it is corrected here.

import {
  clearSession,
  getRefreshToken,
  loginPathFor,
  setAccessToken,
  setRefreshToken,
} from './session';

export const API_BASE_URL =
  import.meta.env.PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8787';

// Business: When a Supabase project is configured, the browser signs staff in DIRECTLY against Supabase
// Business: Auth — the password only ever reaches Supabase, never our Worker. The anon key and project URL
// Business: are public-by-design (they are guarded by Row Level Security); only the service_role key is a
// Business: secret, and that stays on the Worker. With no project set we fall back to the dev login.
// Technical: These two env vars are the entire frontend seam for live auth; absence = offline memory seeds.
export const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY ?? '';

export class BackendNotConfigured extends Error {
  constructor() {
    super('Backend API is not configured yet (frontend-only demo mode).');
    this.name = 'BackendNotConfigured';
  }
}

// What POST /api/requests returns — only the fields a submit screen needs to confirm the job.
export interface CreatedRequest {
  code: string;
  status: string;
}

// What GET /api/track returns — the customer-safe slice (no internal notes, ids, prices).
export interface TrackedRequest {
  code: string;
  status: string;
  appliance: { type: string; brand: string };
  problem: string;
  visitDate?: string;
  updatedAt: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Business: In demo mode there is nothing to call, so fail fast with a clear, catchable error.
  if (!import.meta.env.PUBLIC_API_BASE_URL) {
    throw new BackendNotConfigured();
  }
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

// ── Staff / authenticated surface ────────────────────────────────────────────
// Business: These mirror the REAL Worker responses (verified against the Zod contracts on the server),
// Business: not the aspirational demo shape. Anything the API does not return is simply absent here.
export interface ApiPrice {
  amount: number;
  currency: 'NPR';
  invoiceNumber?: string;
  paymentStatus: 'Paid' | 'Pending';
}

export interface ApiTimelineEvent {
  status: string;
  actor: string;
  at: string;
  note?: string;
}

// The joined admin view = bare lifecycle record + resolved customer + resolved technician (nullable).
export interface ApiRequest {
  code: string;
  status: string;
  source: 'Website' | 'Phone';
  customerId: string;
  technicianId: string | null;
  appliance: { type: string; brand: string; model?: string };
  problem: string;
  fault?: string;
  price?: ApiPrice;
  visitDate?: string;
  urgent?: boolean;
  createdAt: string;
  updatedAt: string;
  timeline: ApiTimelineEvent[];
  customer: { name: string; phone: string; area: string } | null;
  technician: { name: string; phone: string } | null;
}

export interface ApiTechnician {
  id: string;
  name: string;
  phone: string;
  area: string;
  availability: 'online' | 'offline';
  skills: string[];
  activeJobs: number;
}

// Business: A technician's own job row — the record PLUS the customer to visit and how to reach them.
// Business: It is the admin view minus the assigned-technician join, because the reader IS that tech.
export type ApiTechnicianJob = Omit<ApiRequest, 'technician'>;

export interface ApiCustomer {
  id: string;
  name: string;
  phone: string;
  area: string;
}

// Business: The one-job admin view carries, in addition to the record, a DERIVED shortlist of who could
// Business: take it. The server computes this from the live roster + workload; we only render it.
export interface ApiRecommendedTechnician {
  id: string;
  name: string;
  area: string;
  availability: 'online' | 'offline';
  activeJobs: number;
  matchReason: string;
}

export interface ApiRequestDetail extends ApiRequest {
  recommendedTechnicians: ApiRecommendedTechnician[];
}

export interface LoginResult {
  token: string;
  role: 'admin' | 'technician' | 'customer';
}

// Business: What the admin "Add Technician" form sends. The Worker mints a Supabase login from the email +
// Business: initial password AND writes the roster row in one action, so a half-created technician is impossible.
// Technical: Mirrors createTechnicianSchema on the server; `skills` are drawn from the shared APPLIANCE_TYPES.
export interface NewTechnicianInput {
  name: string;
  phone: string;
  email: string;
  area: string;
  skills: string[];
  password: string;
}

// Business: A failed call carries its HTTP status so the caller can tell "wrong password" (401 on login)
// Business: apart from a genuine network fault — without guessing from a message string.
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Business: If the Worker is unreachable OR wedged (accepts the connection but never answers), a bare
// Business: fetch hangs forever and the button sits on "Signing in…" with no feedback. A hard timeout
// Business: guarantees the caller always settles and can show an honest "can't reach the server" message.
// Technical: status 0 means "never got an HTTP response" (network failure or timeout), distinct from 401.
const REQUEST_TIMEOUT_MS = 12_000;
async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(0, 'timeout');
    }
    throw new ApiError(0, 'network');
  } finally {
    clearTimeout(timer);
  }
}

// Business: Both authenticated verbs share one rule: a 401 means the token died, so drop the session and
// Business: send the user back to their own sign-in page rather than render a half-empty screen.
function onExpiredToken(): void {
  const role = currentRoleOr(null);
  clearSession();
  if (typeof window !== 'undefined') window.location.replace(role ? loginPathFor(role) : '/admin/login');
}

// Business: Supabase access tokens are short-lived. Rather than bounce a busy staff member back to the login
// Business: page the moment one expires, we spend the stored refresh token once for a fresh pair and replay the
// Business: call. Only when that too fails is the session genuinely over — then we clear it and redirect.
// Technical: Returns true when a new access token was stored; network/401 on the refresh returns false.
interface SupabaseTokenResponse {
  access_token: string;
  refresh_token: string;
  user?: { app_metadata?: { role?: unknown } };
}

async function exchangeSupabaseToken(
  grant: 'password' | 'refresh_token',
  payload: Record<string, string>,
): Promise<SupabaseTokenResponse> {
  const res = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/token?grant_type=${grant}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new ApiError(res.status === 0 ? 0 : 401, 'auth_failed');
  }
  return (await res.json()) as SupabaseTokenResponse;
}

async function trySilentRefresh(): Promise<boolean> {
  if (!SUPABASE_URL) return false; // offline mode has no refresh token to spend
  const refresh = getRefreshToken();
  if (!refresh) return false;
  try {
    const next = await exchangeSupabaseToken('refresh_token', { refresh_token: refresh });
    setAccessToken(next.access_token);
    setRefreshToken(next.refresh_token);
    return true;
  } catch {
    return false;
  }
}

// Technical: Unlike the public `request()` above, staff calls have no demo fallback — they always target
// the live base URL and attach the bearer token. A 401 earns exactly one silent-refresh replay.
async function authorizedRequest<T>(path: string, init: RequestInit): Promise<T> {
  const send = () =>
    fetchWithTimeout(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { ...init.headers, authorization: `Bearer ${getTokenOrNull() ?? ''}` },
    });
  let res = await send();
  if (res.status === 401 && (await trySilentRefresh())) res = await send();
  if (res.status === 401) {
    onExpiredToken();
    throw new ApiError(401, 'Session expired');
  }
  if (!res.ok) {
    throw new ApiError(res.status, await res.text());
  }
  return (await res.json()) as T;
}

async function authorizedFetch<T>(path: string): Promise<T> {
  return authorizedRequest<T>(path, {});
}

// Technical: The technician portal's writes (accept a job, flip availability) and the admin create-technician
// post share the same read path — one bearer token, one refresh replay, honest status codes on rejection.
async function authorizedPost<T>(path: string, body: unknown): Promise<T> {
  return authorizedRequest<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Small lazy reads so this module owns no storage format of its own.
function getTokenOrNull(): string | null {
  return typeof localStorage === 'undefined' ? null : localStorage.getItem('sl.token');
}
function currentRoleOr(fallback: 'admin' | 'technician' | null) {
  if (typeof localStorage === 'undefined') return fallback;
  const r = localStorage.getItem('sl.role');
  return r === 'admin' || r === 'technician' ? r : fallback;
}

function roleFromMetadata(raw: unknown): LoginResult['role'] {
  return raw === 'admin' || raw === 'technician' ? raw : 'customer';
}

export const staff = {
  // Business: Sign-in goes straight to Supabase Auth when a project is configured — the password never touches
  // Business: our Worker, and the role we land on comes from the token's own app_metadata. With no project set
  // Business: (local dev/tests) we fall back to the Worker's in-memory login so those flows keep working.
  login: async (identifier: string, secret: string): Promise<LoginResult> => {
    if (SUPABASE_URL) {
      const data = await exchangeSupabaseToken('password', { email: identifier, password: secret });
      setRefreshToken(data.refresh_token);
      return { token: data.access_token, role: roleFromMetadata(data.user?.app_metadata?.role) };
    }
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, secret }),
    });
    if (res.status === 401) throw new ApiError(401, 'invalid_credentials');
    if (!res.ok) throw new ApiError(res.status, await res.text());
    return (await res.json()) as LoginResult;
  },

  // Business: One admin action creates a technician's login AND their roster row; a taken email comes back as
  // Business: a 409 the form shows inline. The Worker owns the service_role secret, so the browser never can.
  createTechnician: (payload: NewTechnicianInput) =>
    authorizedPost<{ id: string; name: string }>('/api/admin/technicians', payload),

  listAdminRequests: () => authorizedFetch<ApiRequest[]>('/api/admin/requests'),
  getAdminRequest: (code: string) =>
    authorizedFetch<ApiRequestDetail>(`/api/admin/requests/${encodeURIComponent(code)}`),
  listTechnicians: () => authorizedFetch<ApiTechnician[]>('/api/technicians'),
  listCustomers: () => authorizedFetch<ApiCustomer[]>('/api/customers'),

  // Business: The technician self-service surface. Identity is carried by the token, so these "me" reads
  // Business: need no id in the path — a technician can only ever get their own profile, jobs and toggle.
  me: () => authorizedFetch<ApiTechnician>('/api/technicians/me'),
  myJobs: () => authorizedFetch<ApiTechnicianJob[]>('/api/technicians/me/jobs'),
  setAvailability: (availability: 'online' | 'offline') =>
    authorizedPost<ApiTechnician>('/api/technicians/me/availability', { availability }),
  // Business: The single status a technician may drive — accepting a job already assigned to them. The
  // Business: server re-checks ownership and the transition, so a forged or illegal accept is refused.
  acceptJob: (code: string) =>
    authorizedPost<{ code: string; status: string }>(
      `/api/requests/${encodeURIComponent(code)}/status`,
      { to: 'TECHNICIAN_CONFIRMED' },
    ),
};

export const api = {
  // Business: Customer submits appliance + contact + visit details from the #request form.
  // Technical: Backend validates with Zod and replies with the issued SL-… code we show the customer.
  createServiceRequest: (payload: Record<string, unknown>) =>
    request<CreatedRequest>('/api/requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Business: The "where's my repair?" box needs BOTH the phone and the code together.
  // Technical: GET /api/track; the API answers the same 404 whether the code is unknown or not yours.
  track: (phone: string, code: string) =>
    request<TrackedRequest>(
      `/api/track?phone=${encodeURIComponent(phone)}&code=${encodeURIComponent(code)}`,
    ),
};
