// Business: prove the roster is real — workload is counted from live jobs, availability actually flips
// Business: and sticks, and a technician still sees exactly their own jobs.
// Technical: same createApp + app.request() path; a shared app instance proves state persists.

import { describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { InMemoryRequestRepository } from '../service-requests/request.repository';
import { InMemoryCustomerRepository } from '../customers/customer.repository';
import { InMemoryTechnicianRepository } from './technician.repository';
import { seedRequests } from '../service-requests/fixtures';
import { seedCustomers } from '../customers/fixtures';
import { seedTechnicians } from './fixtures';
import { ADMIN_TOKEN, TECH_TOKEN, authTestDeps } from '../authentication/testing';
import { technicianRecordSchema, technicianRosterSchema } from './technician.schema';
import { serviceRequestRecordSchema, technicianJobSchema } from '../service-requests/request.schema';

function makeApp() {
  return createApp({
    requests: new InMemoryRequestRepository(seedRequests()),
    // Customers are seeded so the technician job join resolves to a real name (C-1003 → Gita Sharma).
    customers: new InMemoryCustomerRepository(seedCustomers()),
    technicians: new InMemoryTechnicianRepository(seedTechnicians()),
    notifier: { send: async () => {} },
    ...authTestDeps(),
  });
}

// Every technician surface is staff-gated; these act as the admin.
const asAdmin = { headers: { authorization: `Bearer ${ADMIN_TOKEN}` } };
// TECH_TOKEN verifies as subject T-2001 (Bikash Thapa) — the technician acting as themselves.
const asTech = { headers: { authorization: `Bearer ${TECH_TOKEN}` } };

function post(body: unknown) {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${ADMIN_TOKEN}` },
    body: JSON.stringify(body),
  };
}

function techPost(body: unknown) {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TECH_TOKEN}` },
    body: JSON.stringify(body),
  };
}

describe('GET /api/technicians (roster)', () => {
  it('lists everyone with workload derived from their live jobs', async () => {
    const roster = technicianRosterSchema.array().parse(await (await makeApp().request('/api/technicians', asAdmin)).json());
    expect(roster).toHaveLength(2);
    // T-2002 holds the one active job (SL-2026-0002 at PRICE_APPROVAL); T-2001's only job is CLOSED.
    expect(roster.find((t) => t.id === 'T-2002')?.activeJobs).toBe(1);
    expect(roster.find((t) => t.id === 'T-2001')?.activeJobs).toBe(0);
  });
});

describe('GET /api/technicians/:id', () => {
  it('returns one technician', async () => {
    const response = await makeApp().request('/api/technicians/T-2001', asAdmin);
    expect(response.status).toBe(200);
    expect(technicianRecordSchema.parse(await response.json()).name).toBe('Bikash Thapa');
  });

  it('404s for an unknown technician', async () => {
    expect((await makeApp().request('/api/technicians/T-9999', asAdmin)).status).toBe(404);
  });
});

describe('POST /api/technicians/:id/availability', () => {
  it('flips availability and persists it', async () => {
    const app = makeApp();
    const flipped = technicianRecordSchema.parse(
      await (await app.request('/api/technicians/T-2001/availability', post({ availability: 'offline' }))).json(),
    );
    expect(flipped.availability).toBe('offline');

    const reread = technicianRecordSchema.parse(await (await app.request('/api/technicians/T-2001', asAdmin)).json());
    expect(reread.availability).toBe('offline');
  });

  it('rejects an invalid value with 400 and an unknown technician with 404', async () => {
    expect((await makeApp().request('/api/technicians/T-2001/availability', post({ availability: 'sleeping' }))).status).toBe(400);
    expect((await makeApp().request('/api/technicians/T-9999/availability', post({ availability: 'online' }))).status).toBe(404);
  });
});

describe('GET /api/technicians/:id/jobs', () => {
  it('returns only that technician\'s jobs', async () => {
    const jobs = serviceRequestRecordSchema.array().parse(await (await makeApp().request('/api/technicians/T-2002/jobs', asAdmin)).json());
    expect(jobs.map((job) => job.code)).toEqual(['SL-2026-0002']);
  });
});

describe('GET /api/technicians/me (self, token-resolved)', () => {
  it('returns the signed-in technician with no id in the path', async () => {
    const response = await makeApp().request('/api/technicians/me', asTech);
    expect(response.status).toBe(200);
    const me = technicianRecordSchema.parse(await response.json());
    expect(me.id).toBe('T-2001');
    expect(me.name).toBe('Bikash Thapa');
  });

  it('refuses an admin token (self-service is technician-only)', async () => {
    expect((await makeApp().request('/api/technicians/me', asAdmin)).status).toBe(403);
  });
});

describe('GET /api/technicians/me/jobs (joined with the customer)', () => {
  it('returns only my jobs, each carrying the customer name/phone/area', async () => {
    const jobs = technicianJobSchema.array().parse(await (await makeApp().request('/api/technicians/me/jobs', asTech)).json());
    // T-2001's single job is the closed SL-2026-0003 for customer C-1003.
    expect(jobs.map((job) => job.code)).toEqual(['SL-2026-0003']);
    expect(jobs[0]?.customer).toEqual({ name: 'Gita Sharma', phone: '9841902385', area: 'Bagbazar' });
  });

  it('never leaks another technician\'s jobs, because "me" is the token subject', async () => {
    const jobs = technicianJobSchema.array().parse(await (await makeApp().request('/api/technicians/me/jobs', asTech)).json());
    expect(jobs.some((job) => job.code === 'SL-2026-0002')).toBe(false);
  });
});

describe('POST /api/technicians/me/availability (self only)', () => {
  it('flips my own availability and it persists on re-read', async () => {
    const app = makeApp();
    const flipped = technicianRecordSchema.parse(await (await app.request('/api/technicians/me/availability', techPost({ availability: 'offline' }))).json());
    expect(flipped.availability).toBe('offline');
    const me = technicianRecordSchema.parse(await (await app.request('/api/technicians/me', asTech)).json());
    expect(me.availability).toBe('offline');
  });

  it('rejects an invalid value with 400', async () => {
    expect((await makeApp().request('/api/technicians/me/availability', techPost({ availability: 'sleeping' }))).status).toBe(400);
  });
});
