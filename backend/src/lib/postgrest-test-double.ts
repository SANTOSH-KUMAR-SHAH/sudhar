// Business: A stand-in for Supabase's REST data API so the repositories can be proven with no live project —
// Business: it hands back exactly the JSON a real PostgREST response would, and remembers what we asked for.
// Technical: Test support only (imported by *.test.ts, never by shipped code). `handler` turns each recorded
// call into the body we resolve; `status` lets a test exercise the failure branches (a 409 unique violation).

import type { FetchLike } from './supabase';

export interface RecordedCall {
  url: URL;
  method: string;
  body?: unknown;
  prefer?: string;
}

export const TEST_CONFIG = { url: 'https://test-project.supabase.co', serviceKey: 'test-service-key' };

export function createFakePostgrest(
  handler: (call: RecordedCall) => unknown,
  status = 200,
): { fetchImpl: FetchLike; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const fetchImpl: FetchLike = async (input, init) => {
    const url = new URL(String(input));
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const raw = typeof init?.body === 'string' ? init.body : undefined;
    const call: RecordedCall = {
      url,
      method: (init?.method ?? 'GET').toUpperCase(),
      body: raw ? JSON.parse(raw) : undefined,
      prefer: headers.prefer,
    };
    calls.push(call);
    return new Response(JSON.stringify(handler(call)), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { fetchImpl, calls };
}
