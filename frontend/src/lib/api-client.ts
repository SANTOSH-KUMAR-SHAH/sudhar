// Business: The website talks to one backend base URL, never hardcoded fetches scattered across pages.
// Business: When no backend is configured it fails a clear way so a screen can fall back to demo mode.
// Technical: Thin fetch wrapper. Shapes below MIRROR the real API (a bare record / array, statuses from
// the shared vocabulary) — the earlier {data:{id}} guess never existed server-side, so it is corrected here.

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

  // Business: Admin/technician portals read live jobs once those screens are converted to call the API.
  // Technical: Kept for wiring; current static pages still render demo-data, so these are unused today.
  listRequests: () => request<unknown[]>('/api/requests'),
  getRequest: (code: string) =>
    request<unknown>(`/api/requests/${encodeURIComponent(code)}`),
};
