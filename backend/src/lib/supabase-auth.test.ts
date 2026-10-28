// Business: These are the two Admin API calls the Worker makes on the service-role key. One must really DELETE the
// Business: user it names (the old query-string form silently listed instead), and the other must report failure
// Business: instead of pretending a broken login was created. Both are proven without touching Supabase.
// Technical: A recording fetch stands in for GoTrue; assertions cover the URL, the verb and the status mapping.

import { describe, expect, it } from 'vitest';
import { createAuthUser, deleteUser, fetchJwks, SupabaseAuthError, type SupabaseAdminConfig } from './supabase-auth';

const CONFIG: SupabaseAdminConfig = {
  url: 'https://test-project.supabase.co',
  serviceKey: 'service-key',
};

interface Recorded {
  url: URL;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}

function recordingFetch(response: Response | (() => Response)) {
  const calls: Recorded[] = [];
  const fetchImpl = (async (input: string, init?: RequestInit) => {
    calls.push({
      url: new URL(String(input)),
      method: (init?.method ?? 'GET').toUpperCase(),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    return typeof response === 'function' ? response() : response;
  }) as unknown as typeof globalThis.fetch;
  return { fetchImpl, calls };
}

describe('deleteUser (Admin API)', () => {
  it('addresses the user by PATH with DELETE — the query-string form never deleted anything', async () => {
    const { fetchImpl, calls } = recordingFetch(new Response(null, { status: 204 }));
    await deleteUser(CONFIG, 'auth-user-1', fetchImpl);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe('DELETE');
    expect(calls[0]!.url.pathname).toBe('/auth/v1/admin/users/auth-user-1');
    // Regression: `?user_id=` was accepted as a LISTING call, so the login survived the rollback.
    expect(calls[0]!.url.search).toBe('');
    expect(calls[0]!.headers.authorization).toBe('Bearer service-key');
  });

  it('treats 404 as success — the account is already gone, which is the outcome we wanted', async () => {
    const { fetchImpl } = recordingFetch(new Response('not found', { status: 404 }));
    await expect(deleteUser(CONFIG, 'auth-user-1', fetchImpl)).resolves.toBeUndefined();
  });

  it('fails loudly on any other status, so an orphaned login cannot be swallowed', async () => {
    const { fetchImpl } = recordingFetch(new Response('boom', { status: 500 }));
    await expect(deleteUser(CONFIG, 'auth-user-1', fetchImpl)).rejects.toBeInstanceOf(SupabaseAuthError);
    await expect(deleteUser(CONFIG, 'auth-user-1', fetchImpl)).rejects.toMatchObject({ status: 500 });
  });
});

describe('createAuthUser (Admin API)', () => {
  it('confirms the email and carries role metadata inside the signed token', async () => {
    const { fetchImpl, calls } = recordingFetch(
      new Response(JSON.stringify({ id: 'auth-user-1' }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const id = await createAuthUser(
      CONFIG,
      { email: 'tech@example.com', password: 'a-long-password', appMetadata: { role: 'technician', technicianId: 'T-2003' } },
      fetchImpl,
    );

    expect(id).toBe('auth-user-1');
    expect(calls[0]!.url.pathname).toBe('/auth/v1/admin/users');
    expect(calls[0]!.body).toMatchObject({
      email: 'tech@example.com',
      email_confirm: true,
      app_metadata: { role: 'technician', technicianId: 'T-2003' },
    });
  });

  it('maps "already registered" to a 409 the API can render as a conflict', async () => {
    const { fetchImpl } = recordingFetch(new Response('User already registered', { status: 422 }));
    await expect(
      createAuthUser(CONFIG, { email: 'taken@example.com', password: 'a-long-password', appMetadata: {} }, fetchImpl),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('fetchJwks', () => {
  it('rejects a non-2xx key fetch rather than caching an empty key set', async () => {
    const { fetchImpl } = recordingFetch(new Response('down', { status: 503 }));
    await expect(fetchJwks(CONFIG.url, fetchImpl)).rejects.toBeInstanceOf(SupabaseAuthError);
  });

  it('returns the published keys', async () => {
    const keys = [{ kid: 'k1', kty: 'RSA', n: 'n', e: 'AQAB' }];
    const { fetchImpl, calls } = recordingFetch(
      new Response(JSON.stringify({ keys }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    await expect(fetchJwks(CONFIG.url, fetchImpl)).resolves.toEqual(keys);
    expect(calls[0]!.url.pathname).toBe('/auth/v1/.well-known/jwks.json');
  });
});
