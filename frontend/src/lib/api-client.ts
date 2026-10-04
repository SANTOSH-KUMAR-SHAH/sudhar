// Business: The website must talk to one backend base URL, never hardcoded fetches
// Business: scattered across pages. Today there is no backend, so calls fail loudly.
// Technical: Thin fetch wrapper with typed errors. Pages catch BackendNotConfigured
// and keep showing mock data with an explicit demo banner instead of pretending.

export const API_BASE_URL =
  import.meta.env.PUBLIC_API_BASE_URL ?? 'http://localhost:8787';

export class BackendNotConfigured extends Error {
  constructor() {
    super('Backend API is not configured yet (frontend-only demo mode).');
    this.name = 'BackendNotConfigured';
  }
}

export interface ApiResult<T> {
  data: T;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Business: In demo mode there is nothing to call, so fail fast with a clear error.
  // Technical: Central place to add auth headers + rate-limit handling when backend lands.
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
  // Business: Customer submits appliance + contact + visit details from #request form.
  // Technical: POST /api/requests with Zod validation server-side (backend phase).
  createServiceRequest: (payload: Record<string, unknown>) =>
    request<ApiResult<{ id: string }>>('/api/requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Business: Admin/tech portals read live jobs once the API exists.
  // Technical: GET endpoints; currently unused by mock pages, kept for wiring.
  listRequests: () => request<ApiResult<unknown[]>>('/api/requests'),
  getRequest: (id: string) =>
    request<ApiResult<unknown>>(`/api/requests/${encodeURIComponent(id)}`),
};
