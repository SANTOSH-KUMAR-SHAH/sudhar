// Business: This is the ONLY file that knows "Supabase" exists. Every repository below talks to the data
// Business: API through this one small client, so if we ever change provider the business rules never move.
// Business: We deliberately reach for Supabase's plain REST data API (not the SDK): it needs no new npm
// Business: dependency, runs on the Worker's own fetch, and keeps the type-check honest with nothing to stub.
// Technical: One thin wrapper over PostgREST. Reads always come back as arrays (we pick the row ourselves)
// so a missing row is a clean empty list, never a 406. Every call is timed-out so a hung DB can't hang us.

export interface SupabaseConfig {
  url: string;
  serviceKey: string;
}

// A row as the REST API returns it: snake_case columns, JSONB nested as real objects.
export type RestRow = Record<string, unknown>;

// Business: A list query ("these customers", "these technicians") must be ONE round-trip, not one per id —
// Business: the per-id form is what multiplied every admin page into hundreds of subrequests.
// Technical: PostgREST `in.()` grammar. Each value is quoted and its backslash/quote escaped, so a value can
// Technical: never terminate the list and append a filter of the caller's choosing.
export function inFilter(values: string[]): string {
  const quoted = values.map((value) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
  return `in.(${quoted.join(',')})`;
}

// Injectable so tests (and any future retry policy) can hand in a fake without a live database.
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface PostgrestClientOptions {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

// Business: A Supabase failure is surfaced as a typed error so callers log the truth, not a bare 500.
export class SupabaseError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'SupabaseError';
  }
}

export class PostgrestClient {
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(private readonly config: SupabaseConfig, options: PostgrestClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  // Business: Fetch every row matching a set of ready-made PostgREST filters (e.g. "technician_id=eq.T-2001").
  async select(table: string, filters: string[] = [], order?: string): Promise<RestRow[]> {
    const data = await this.request<RestRow[]>('GET', table, { filters });
    return data ?? [];
  }

  // Business: Insert one row and get the stored copy back, so the caller sees defaults the DB filled in.
  async insert(table: string, value: RestRow): Promise<RestRow | null> {
    const rows = await this.request<RestRow[]>('POST', table, {
      body: value,
      prefer: 'return=representation',
    });
    return rows?.[0] ?? null;
  }

  // Business: Update the rows matching `filters` and return the first updated copy (or null if none matched).
  async update(table: string, filters: string[], value: RestRow): Promise<RestRow | null> {
    const rows = await this.request<RestRow[]>('PATCH', table, {
      filters,
      body: value,
      prefer: 'return=representation',
    });
    return rows?.[0] ?? null;
  }

  // Business: Call a Postgres function by name (used for the staff-only technician-id sequence).
  // Technical: Request codes are NOT minted this way any more — they are random in the Worker, so the public
  // Technical: request-code RPC was removed from the schema entirely (see migrations/0004_lock_down.sql).
  async rpc<T>(fn: string, params: RestRow = {}): Promise<T> {
    return this.request<T>('POST', `rpc/${fn}`, { body: params });
  }

  private async request<T>(
    method: string,
    path: string,
    opts: { filters?: string[]; body?: unknown; prefer?: string },
  ): Promise<T> {
    const url = new URL(`/rest/v1/${path}`, this.config.url);
    if (opts.filters?.length) url.search = opts.filters.join('&');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers: Record<string, string> = {
        apikey: this.config.serviceKey,
        authorization: `Bearer ${this.config.serviceKey}`,
        accept: 'application/json',
      };
      if (opts.body !== undefined) headers['content-type'] = 'application/json';
      if (opts.prefer) headers.prefer = opts.prefer;

      const response = await this.fetchImpl(url.toString(), {
        method,
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new SupabaseError(`supabase ${method} ${path} failed: ${response.status} ${detail}`, response.status);
      }
      // 204 (delete / no representation) has no body to parse.
      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }
}
