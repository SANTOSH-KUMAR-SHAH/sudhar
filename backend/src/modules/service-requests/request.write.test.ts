// Business: prove the two writes behave exactly as the promises say — a submit mints a code and fires
// Business: the one message; an admin move either advances the job or is refused by the workflow.
// Technical: same createApp + app.request() path as production, with a fixed clock (deterministic codes)
// and a recording notifier (assert the message without sending it).

import { describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { InMemoryRequestRepository } from './request.repository';
import { InMemoryCustomerRepository } from '../customers/customer.repository';
import { seedRequests } from './fixtures';
import { serviceRequestRecordSchema, type ServiceRequestRecordView } from './request.schema';

const CLOCK = '2026-10-10T09:30:00+05:45';

function json(body: unknown) {
  return { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}

function makeApp() {
  const sent: { phone: string; code: string }[] = [];
  const app = createApp({
    requests: new InMemoryRequestRepository(seedRequests()),
    customers: new InMemoryCustomerRepository(),
    notifier: { send: async (message) => { sent.push(message); } },
    clock: () => CLOCK,
  });
  return { app, sent };
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
  it('creates a job at NEW_REQUEST, mints a code and fires the one message', async () => {
    const { app, sent } = makeApp();
    const response = await app.request('/api/requests', json(validSubmission));

    expect(response.status).toBe(201);
    const record = serviceRequestRecordSchema.parse(await response.json());
    expect(record.status).toBe('NEW_REQUEST');
    expect(record.code).toMatch(/^SL-2026-\d{4}$/);
    expect(record.timeline).toHaveLength(1);
    expect(record.timeline[0]?.actor).toBe('customer');
    // The request code went to the customer's phone — and nowhere else.
    expect(sent).toEqual([{ phone: validSubmission.phone, code: record.code }]);
  });

  it('credits a phone-in to the admin, not the customer', async () => {
    const { app } = makeApp();
    const response = await app.request('/api/requests', json({ ...validSubmission, source: 'Phone' }));
    const record = serviceRequestRecordSchema.parse(await response.json());
    expect(record.timeline[0]?.actor).toBe('admin');
  });

  it('rejects an invalid Nepal phone with a clean 400 before any record is made', async () => {
    const { app, sent } = makeApp();
    const response = await app.request('/api/requests', json({ ...validSubmission, phone: '12345' }));
    expect(response.status).toBe(400);
    expect((await response.json() as { error?: string }).error).toBe('contract_violation');
    expect(sent).toHaveLength(0);
  });

  it('reuses one customer by phone and never repeats a code', async () => {
    const { app } = makeApp();
    const first = serviceRequestRecordSchema.parse(await (await app.request('/api/requests', json(validSubmission))).json());
    const second = serviceRequestRecordSchema.parse(await (await app.request('/api/requests', json(validSubmission))).json());
    expect(second.customerId).toBe(first.customerId);
    expect(second.code).not.toBe(first.code);
  });
});

describe('POST /api/requests/:code/status (admin advance)', () => {
  it('advances a legal move and appends the timeline event', async () => {
    const { app } = makeApp();
    const response = await app.request('/api/requests/SL-2026-0001/status', json({ to: 'UNDER_REVIEW', note: 'Called customer' }));
    expect(response.status).toBe(200);
    const record = serviceRequestRecordSchema.parse(await response.json());
    expect(record.status).toBe('UNDER_REVIEW');
    expect(record.timeline).toHaveLength(2);
    expect(record.timeline[1]).toMatchObject({ status: 'UNDER_REVIEW', actor: 'admin', note: 'Called customer' });
  });

  it('refuses an illegal jump with 409 and leaves the record untouched', async () => {
    const { app } = makeApp();
    const response = await app.request('/api/requests/SL-2026-0001/status', json({ to: 'COMPLETED' }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'illegal_transition', from: 'NEW_REQUEST', to: 'COMPLETED' });

    const stillThere: ServiceRequestRecordView = serviceRequestRecordSchema.parse(
      await (await app.request('/api/requests/SL-2026-0001')).json(),
    );
    expect(stillThere.status).toBe('NEW_REQUEST');
    expect(stillThere.timeline).toHaveLength(1);
  });

  it('returns 404 for an unknown code', async () => {
    const { app } = makeApp();
    const response = await app.request('/api/requests/SL-2026-9999/status', json({ to: 'UNDER_REVIEW' }));
    expect(response.status).toBe(404);
  });
});
