// Business: the customer-facing "where's my repair?" flow, proved end to end and proved SAFE.
// Technical: real createApp + app.request(); submit a job, then track it. Covers the anti-enumeration
// guarantee (unknown code and someone-else's code look identical) and the customer-safe projection.

import { describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { PolicyRateLimiter, type RateLimiter } from '../../lib/rate-limit';
import { InMemoryRequestRepository } from './request.repository';
import { InMemoryCustomerRepository } from '../customers/customer.repository';
import { InMemoryTechnicianRepository } from '../technicians/technician.repository';
import { seedTechnicians } from '../technicians/fixtures';
import { ADMIN_TOKEN, authTestDeps } from '../authentication/testing';
import { seedRequests } from './fixtures';
import { trackedRequestSchema } from './request.schema';

const CLOCK = '2026-10-10T09:30:00+05:45';

function makeApp(rateLimiter?: RateLimiter) {
  return createApp({
    requests: new InMemoryRequestRepository(seedRequests()),
    customers: new InMemoryCustomerRepository(),
    technicians: new InMemoryTechnicianRepository(seedTechnicians()),
    notifier: { send: async () => {} },
    clock: () => CLOCK,
    ...authTestDeps(),
    ...(rateLimiter ? { rateLimiter } : {}),
  });
}

// Business: The live budgets from index.ts, except the per-phone Track budget is made tiny (2) so the sweep
// Business: test stays deterministic and fast. Every policy is declared because an unknown one throws by design.
function throttledApp() {
  return makeApp(
    new PolicyRateLimiter(
      {
        'intake-ip': { limit: 100, windowMs: 60_000 },
        'intake-phone': { limit: 100, windowMs: 60_000 },
        'track-ip': { limit: 100, windowMs: 60_000 },
        'track-phone': { limit: 2, windowMs: 60_000 },
        'auth-ip': { limit: 100, windowMs: 60_000 },
      },
      () => 0,
    ),
  );
}

function post(body: unknown) {
  return { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}

async function submit(app: ReturnType<typeof makeApp>, phone = '9812345678') {
  const response = await app.request(
    '/api/requests',
    post({ appliance: 'Air Conditioner', brand: 'LG', problem: 'Not cooling', name: 'Sita', phone, area: 'Baneshwar' }),
  );
  // The public submit now returns only the customer-safe confirmation; these tests just need the code.
  expect(response.status).toBe(201);
  return (await response.json()) as { code: string; status: string };
}

const trackUrl = (phone: string, code?: string) =>
  // Technical: encode — a literal `+` in a query string decodes to a space, which would make a +977 number
  // Technical: look invalid instead of exercising the budget.
  `/api/track?phone=${encodeURIComponent(phone)}${code !== undefined ? `&code=${encodeURIComponent(code)}` : ''}`;

describe('GET /api/track (customer-safe)', () => {
  it('returns only the safe slice of the job', async () => {
    const app = makeApp();
    const created = await submit(app);
    const response = await app.request(trackUrl('9812345678', created.code));
    expect(response.status).toBe(200);

    // The whole point: internal data must never reach a public caller.
    const raw = (await response.json()) as Record<string, unknown>;
    const view = trackedRequestSchema.parse(raw);
    expect(view).toMatchObject({ code: created.code, status: 'NEW_REQUEST' });

    for (const forbidden of ['timeline', 'customerId', 'technicianId', 'price', 'fault', 'source']) {
      expect(raw).not.toHaveProperty(forbidden);
    }
  });

  it('reflects a status the admin just advanced', async () => {
    const app = makeApp();
    const created = await submit(app);
    await app.request(`/api/requests/${created.code}/status`, {
      ...post({ to: 'UNDER_REVIEW' }),
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ADMIN_TOKEN}` },
    });

    const view = trackedRequestSchema.parse(await (await app.request(trackUrl('9812345678', created.code))).json());
    expect(view.status).toBe('UNDER_REVIEW');
  });

  it('treats +977 and local formats as the same customer', async () => {
    const app = makeApp();
    const created = await submit(app, '+9779812345678');
    const response = await app.request(trackUrl('9812345678', created.code));
    expect(response.status).toBe(200);
  });

  it('rejects a missing phone or code with 400', async () => {
    const app = makeApp();
    expect((await app.request(trackUrl('9812345678'))).status).toBe(400);

    const created = await submit(app);
    const missingPhone = await app.request(`/api/track?code=${created.code}`);
    expect(missingPhone.status).toBe(400);
  });

  it('answers identically for an unknown code and a code that is not yours', async () => {
    const app = makeApp();
    const created = await submit(app);

    const unknown = await app.request(trackUrl('9812345678', 'SL-2026-9999'));
    const wrongOwner = await app.request(trackUrl('9899999999', created.code));

    expect(unknown.status).toBe(404);
    expect(wrongOwner.status).toBe(404);
    // Same body, so a guesser cannot tell a real code from a fake one.
    expect(await wrongOwner.json()).toEqual(await unknown.json());
  });
});

describe('GET /api/track (per-victim guess budget)', () => {
  it('ends a sweep after the per-phone misses are spent', async () => {
    const app = throttledApp();
    // Two misses (the budget) answer 404; the next is refused before another code is disclosed.
    expect((await app.request(trackUrl('9899999999', 'SL-2026-9999'))).status).toBe(404);
    expect((await app.request(trackUrl('9899999999', 'SL-2026-9998'))).status).toBe(404);
    const blocked = await app.request(trackUrl('9899999999', 'SL-2026-9997'));
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: 'rate_limited' });
  });

  it('does not charge a legitimate owner — successful reads are free', async () => {
    const app = throttledApp();
    const created = await submit(app);
    // Five correct lookups, where the per-phone budget is only 2: the owner is never locked out.
    for (let i = 0; i < 5; i += 1) {
      expect((await app.request(trackUrl('9812345678', created.code))).status).toBe(200);
    }
  });

  it('does not let a re-spelled number (+977) buy a second guess budget', async () => {
    const app = throttledApp();
    expect((await app.request(trackUrl('9899999999', 'SL-2026-9999'))).status).toBe(404);
    expect((await app.request(trackUrl('9899999999', 'SL-2026-9998'))).status).toBe(404);
    expect((await app.request(trackUrl('+9779899999999', 'SL-2026-9997'))).status).toBe(429);
  });
});
