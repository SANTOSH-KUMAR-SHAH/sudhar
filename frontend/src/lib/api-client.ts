// Business: The website talks to one backend base URL, never hardcoded fetches scattered across pages.
// Business: When no backend is configured it fails a clear way so a screen can fall back to demo mode.
// Technical: Thin fetch wrapper. Shapes below MIRROR the real API (a bare record / array, statuses from
// the shared vocabulary) — the earlier {data:{id}} guess never existed server-side, so it is corrected here.

import { clearSession, loginPathFor } from './session';

export const API_BASE_URL =
  import.meta.env.PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8787';

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

// Technical: Unlike the public `request()` above, staff calls have no demo fallback — they always target
// the live base URL and attach the bearer token.
async function authorizedFetch<T>(path: string): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
    headers: { authorization: `Bearer ${getTokenOrNull() ?? ''}` },
  });
  if (res.status === 401) {
    onExpiredToken();
    throw new ApiError(401, 'Session expired');
  }
  if (!res.ok) {
    throw new ApiError(res.status, await res.text());
  }
  return (await res.json()) as T;
}

// Technical: The technician portal's two writes (accept a job, flip availability) post a JSON body with
// the same token handling as reads — a dead token redirects, a rejected move surfaces its status code.
async function authorizedPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', authorization: `Bearer ${getTokenOrNull() ?? ''}` },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    onExpiredToken();
    throw new ApiError(401, 'Session expired');
  }
  if (!res.ok) {
    throw new ApiError(res.status, await res.text());
  }
  return (await res.json()) as T;
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

export const staff = {
  // Business: Sign-in is a real round trip; a wrong credential is a 401 we surface, never a silent redirect.
  login: async (identifier: string, secret: string): Promise<LoginResult> => {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, secret }),
    });
    if (res.status === 401) throw new ApiError(401, 'invalid_credentials');
    if (!res.ok) throw new ApiError(res.status, await res.text());
    return (await res.json()) as LoginResult;
  },

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

  // Business: The public, unauthenticated reads below predate the staff surface. Both portals now read the
  // Business: authorized staff.* methods, so these remain a thin seam for any future public queue view.
  // Technical: demo-data has been deleted — every staff screen is live; nothing falls back to mocks now.
  listRequests: () => request<unknown[]>('/api/requests'),
  getRequest: (code: string) =>
    request<unknown>(`/api/requests/${encodeURIComponent(code)}`),
};
