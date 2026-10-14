// Business: prove the gate is real, not decorative — you must sign in, a forged token fails, the wrong
// Business: role is refused, a technician can't touch another's availability, and the timeline records
// Business: WHO actually acted (from the token) rather than who the body pretended.
// Technical: mixes the live session verifier (login → token → use) with the static one (fixed roles),
// plus a fixed-window limiter fast-forwarded by an injected clock so the 429 is deterministic.

import { describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { FixedWindowRateLimiter } from '../../lib/rate-limit';
import { InMemoryRequestRepository } from '../service-requests/request.repository';
import { seedRequests } from '../service-requests/fixtures';
import { InMemoryCustomerRepository } from '../customers/customer.repository';
import { InMemoryTechnicianRepository } from '../technicians/technician.repository';
import { seedTechnicians } from '../technicians/fixtures';
import { ADMIN_TOKEN, TECH_TOKEN, authTestDeps } from './testing';
import { InMemorySessionTokens, SessionAuthVerifier } from './session';
import { InMemoryStaffRepository, seedStaff } from './staff';

function json(body: unknown, token?: string) {
  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  };
}

function appWith(overrides: Record<string, unknown> = {}) {
  return createApp({
    requests: new InMemoryRequestRepository(seedRequests()),
    customers: new InMemoryCustomerRepository(),
    technicians: new InMemoryTechnicianRepository(seedTechnicians()),
    notifier: { send: async () => {} },
    ...authTestDeps(),
    ...overrides,
  } as never);
}

describe('POST /api/auth/login (live session verifier)', () => {
  it('issues a token that the guard then accepts, and rejects anything forged', async () => {
    const tokens = new InMemorySessionTokens();
    const app = appWith({ auth: new SessionAuthVerifier(tokens), tokens, staff: new InMemoryStaffRepository(seedStaff()) });

    const bad = await app.request('/api/auth/login', json({ identifier: 'admin', secret: 'wrong' }));
    expect(bad.status).toBe(401);

    const ok = await app.request('/api/auth/login', json({ identifier: 'admin', secret: 'sudhar-dev' }));
    expect(ok.status).toBe(200);
    const { token } = (await ok.json()) as { token: string };

    // The issued token really opens an admin surface…
    const asAdmin = await app.request('/api/admin/requests', { headers: { authorization: `Bearer ${token}` } });
    expect(asAdmin.status).toBe(200);

    // …while a made-up token that was never issued does not (401, not 200, not a leak).
    const forged = await app.request('/api/admin/requests', { headers: { authorization: 'Bearer i-made-this-up' } });
    expect(forged.status).toBe(401);
  });
});

describe('authorization guard', () => {
  it('401s with no token and 403s with the wrong role', async () => {
    const app = appWith();
    expect((await app.request('/api/admin/requests')).status).toBe(401);
    expect((await app.request('/api/admin/requests', { headers: { authorization: `Bearer ${TECH_TOKEN}` } })).status).toBe(403);
  });

  it('records the actor from the token, never from the body', async () => {
    const app = appWith();
    // The body tries to claim actor:'customer'; the verified admin acts, and that field is stripped by
    // the schema — so the timeline can never be forged by whoever is calling.
    const response = await app.request('/api/requests/SL-2026-0001/status', json({ to: 'UNDER_REVIEW', actor: 'customer' }, ADMIN_TOKEN));
    expect(response.status).toBe(200);
    const record = (await response.json()) as { timeline: { actor: string }[] };
    expect(record.timeline.at(-1)?.actor).toBe('admin');
  });

  it('admin is the sole status driver — a technician cannot take an admin-only step', async () => {
    const app = appWith();
    const response = await app.request('/api/requests/SL-2026-0001/status', json({ to: 'UNDER_REVIEW' }, TECH_TOKEN));
    expect(response.status).toBe(403);
  });

  it('a technician may only accept a job assigned to them', async () => {
    const app = appWith();
    // TECH_TOKEN is T-2001; SL-2026-0002 is assigned to T-2002 — accepting someone else's job is refused.
    const wrongTech = await app.request('/api/requests/SL-2026-0002/status', json({ to: 'TECHNICIAN_CONFIRMED' }, TECH_TOKEN));
    expect(wrongTech.status).toBe(403);
  });

  it('a technician can read only their own jobs, while an admin reads any', async () => {
    const app = appWith();
    expect((await app.request('/api/technicians/T-2002/jobs', { headers: { authorization: `Bearer ${TECH_TOKEN}` } })).status).toBe(403);
    expect((await app.request('/api/technicians/T-2001/jobs', { headers: { authorization: `Bearer ${TECH_TOKEN}` } })).status).toBe(200);
  });

  it('lets a technician change only their own availability', async () => {
    const app = appWith();
    // TECH_TOKEN's subject is T-2001, so touching T-2002 is another technician's row.
    expect((await app.request('/api/technicians/T-2002/availability', json({ availability: 'offline' }, TECH_TOKEN))).status).toBe(403);
    expect((await app.request('/api/technicians/T-2001/availability', json({ availability: 'offline' }, TECH_TOKEN))).status).toBe(200);
  });
});
describe('rate limiting (public endpoints)', () => {
  it('returns 429 once the window budget is spent', async () => {
    const app = appWith({ rateLimiter: new FixedWindowRateLimiter({ limit: 2, windowMs: 60_000, now: () => 0 }) });
    // A valid-but-mismatched query is a 404 (wrong owner) — the point is the first two pass the gate.
    expect((await app.request('/api/track?phone=9812345678&code=SL-2026-0001')).status).toBe(404); // first counts
    expect((await app.request('/api/track?phone=9812345678&code=SL-2026-0001')).status).toBe(404); // second counts
    const third = await app.request('/api/track?phone=9812345678&code=SL-2026-0001');
    expect(third.status).toBe(429);
    expect(await third.json()).toEqual({ error: 'rate_limited' });
  });
});
