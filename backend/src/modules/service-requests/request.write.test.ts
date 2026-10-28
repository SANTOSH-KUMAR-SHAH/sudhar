// Business: prove the two writes behave exactly as the promises say — a submit mints a code and fires
// Business: the one message; an admin move either advances the job or is refused by the workflow.
// Technical: same createApp + app.request() path as production, with a fixed clock (deterministic codes)
// and a recording notifier (assert the message without sending it).

import { describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { PolicyRateLimiter, type RateLimiter } from '../../lib/rate-limit';
import { InMemoryRequestRepository } from './request.repository';
import { InMemoryCustomerRepository } from '../customers/customer.repository';
import { InMemoryTechnicianRepository } from '../technicians/technician.repository';
import { seedTechnicians } from '../technicians/fixtures';
import { ADMIN_TOKEN, authTestDeps } from '../authentication/testing';
import { seedRequests } from './fixtures';
import { serviceRequestRecordSchema } from './request.schema';

const CLOCK = '2026-10-10T09:30:00+05:45';

function json(body: unknown) {
  return { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}

// The advance endpoint is staff-only; every move in these tests is signed as the admin.
function authedJson(body: unknown) {
  const init = json(body);
  return { ...init, headers: { ...init.headers, authorization: `Bearer ${ADMIN_TOKEN}` } };
}

function makeApp(rateLimiter?: RateLimiter) {
  const sent: { phone: string; code: string }[] = [];
  const requests = new InMemoryRequestRepository(seedRequests());
  const app = createApp({
    requests,
    customers: new InMemoryCustomerRepository(),
    technicians: new InMemoryTechnicianRepository(seedTechnicians()),
    notifier: { send: async (message) => { sent.push(message); } },
    clock: () => CLOCK,
    ...authTestDeps(),
    ...(rateLimiter ? { rateLimiter } : {}),
  });
  // The public POST now returns only { code, status }; these tests assert the FULL stored record by
  // reading the repository back directly (findByCode) — proving submit really persisted what we expect.
  return { app, sent, requests };
}

// Read a stored job back through the repository (the same data a guarded staff read would serve).
async function storedCode(app: ReturnType<typeof makeApp>['app'], body: unknown): Promise<string> {
  const response = await app.request('/api/requests', json(body));
  expect(response.status).toBe(201);
  return ((await response.json()) as { code: string }).code;
}

const validSubmission = {
  appliance: 'Air Conditioner',
  brand: 'LG',
  problem: 'Not cooling',
  name: 'Sita Gurung',
  phone: '9812345678',
  area: 'Baneshwar',
};

describe('POST /api/requests (customer submit)', () => {
  it('confirms with just code+status, stores the job at NEW_REQUEST, and fires the one message', async () => {
    const { app, sent, requests } = makeApp();
    const response = await app.request('/api/requests', json(validSubmission));

    expect(response.status).toBe(201);
    // The response is minimised — a stranger sees only their own confirmation, never internal ids.
    const created = (await response.json()) as Record<string, unknown>;
    expect(Object.keys(created).sort()).toEqual(['code', 'status']);
    expect(created.status).toBe('NEW_REQUEST');
    expect(String(created.code)).toMatch(/^SL-2026-\d{6}$/);

    // The stored aggregate (read back from the repository) carries the customer-created timeline event.
    const record = serviceRequestRecordSchema.parse((await requests.findByCode(String(created.code)))!.toRecord());
    expect(record.timeline).toHaveLength(1);
    expect(record.timeline[0]?.actor).toBe('customer');
    // The request code went to the customer's phone — and nowhere else.
    expect(sent).toEqual([{ phone: validSubmission.phone, code: created.code }]);
  });

  it('ignores a spoofed Phone source on the public endpoint — it stays a Website lead', async () => {
    const { app, sent, requests } = makeApp();
    const code = await storedCode(app, { ...validSubmission, source: 'Phone' });
    const record = (await requests.findByCode(code))!.toRecord();
    // The channel is server-decided: a body claiming 'Phone' cannot skip the SMS or claim an admin actor.
    expect(record.source).toBe('Website');
    expect(record.timeline[0]?.actor).toBe('customer');
    expect(sent).toHaveLength(1);
  });

  it('rejects an invalid Nepal phone with a clean 400 before any record is made', async () => {
    const { app, sent } = makeApp();
    const response = await app.request('/api/requests', json({ ...validSubmission, phone: '12345' }));
    expect(response.status).toBe(400);
    expect((await response.json() as { error?: string }).error).toBe('contract_violation');
    expect(sent).toHaveLength(0);
  });

  it('stores a customer-flagged urgency, and leaves an ordinary job without the noise', async () => {
    const { app, requests } = makeApp();
    const flaggedCode = await storedCode(app, { ...validSubmission, urgent: true });
    expect((await requests.findByCode(flaggedCode))!.toRecord().urgent).toBe(true);

    const ordinaryCode = await storedCode(app, { ...validSubmission, phone: '9898765432' });
    expect((await requests.findByCode(ordinaryCode))!.toRecord().urgent).toBeUndefined();
  });

  it('reuses one customer by phone and never repeats a code', async () => {
    const { app, requests } = makeApp();
    const firstCode = await storedCode(app, validSubmission);
    const secondCode = await storedCode(app, validSubmission);
    const first = (await requests.findByCode(firstCode))!.toRecord();
    const second = (await requests.findByCode(secondCode))!.toRecord();
    expect(second.customerId).toBe(first.customerId);
    expect(second.code).not.toBe(first.code);
  });
});

describe('POST /api/requests/:code/status (admin advance)', () => {
  it('advances a legal move and appends the timeline event', async () => {
    const { app } = makeApp();
    const response = await app.request('/api/requests/SL-2026-0001/status', authedJson({ to: 'UNDER_REVIEW', note: 'Called customer' }));
    expect(response.status).toBe(200);
    const record = serviceRequestRecordSchema.parse(await response.json());
    expect(record.status).toBe('UNDER_REVIEW');
    expect(record.timeline).toHaveLength(2);
    expect(record.timeline[1]).toMatchObject({ status: 'UNDER_REVIEW', actor: 'admin', note: 'Called customer' });
  });

  it('refuses an illegal jump with 409 and leaves the record untouched', async () => {
    const { app, requests } = makeApp();
    const response = await app.request('/api/requests/SL-2026-0001/status', authedJson({ to: 'COMPLETED' }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'illegal_transition', from: 'NEW_REQUEST', to: 'COMPLETED' });

    const stillThere = serviceRequestRecordSchema.parse((await requests.findByCode('SL-2026-0001'))!.toRecord());
    expect(stillThere.status).toBe('NEW_REQUEST');
    expect(stillThere.timeline).toHaveLength(1);
  });

  it('returns 404 for an unknown code', async () => {
    const { app } = makeApp();
    const response = await app.request('/api/requests/SL-2026-9999/status', authedJson({ to: 'UNDER_REVIEW' }));
    expect(response.status).toBe(404);
  });
});

// Business: The public form is anonymous and sends an SMS per submission, so one number may not be used as a
// Business: free text-message cannon. Three an hour covers a household; the budget is per phone, not global.
describe('POST /api/requests (per-phone intake budget)', () => {
  function throttledApp() {
    return makeApp(
      new PolicyRateLimiter(
        {
          'intake-ip': { limit: 100, windowMs: 60_000 },
          'intake-phone': { limit: 3, windowMs: 60_000 },
          'track-ip': { limit: 100, windowMs: 60_000 },
          'track-phone': { limit: 100, windowMs: 60_000 },
          'auth-ip': { limit: 100, windowMs: 60_000 },
        },
        () => 0,
      ),
    );
  }

  it('accepts three submissions from one phone, then answers 429 before minting a fourth job or SMS', async () => {
    const { app, sent } = throttledApp();
    for (let i = 0; i < 3; i += 1) {
      expect((await app.request('/api/requests', json(validSubmission))).status).toBe(201);
    }
    const blocked = await app.request('/api/requests', json(validSubmission));
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: 'rate_limited' });
    // The refused attempt produced no message at all.
    expect(sent).toHaveLength(3);
  });

  it('keys the budget per phone — a throttled number does not lock the next customer out', async () => {
    const { app } = throttledApp();
    for (let i = 0; i < 3; i += 1) {
      await app.request('/api/requests', json(validSubmission));
    }
    expect((await app.request('/api/requests', json(validSubmission))).status).toBe(429);
    expect((await app.request('/api/requests', json({ ...validSubmission, phone: '9801234567' }))).status).toBe(201);
  });

  it('does not let a re-spelled number (+977) buy a second allowance', async () => {
    const { app } = throttledApp();
    for (let i = 0; i < 3; i += 1) {
      await app.request('/api/requests', json(validSubmission));
    }
    // Same person, different spelling — the budget is keyed on the normalised identity.
    const reSpelled = await app.request('/api/requests', json({ ...validSubmission, phone: '+9779812345678' }));
    expect(reSpelled.status).toBe(429);
  });
});
