// Business: the admin queue carries the customer and technician NAMES inline — this is the join the
// Business: demo pages assumed. An unassigned intake shows a null technician, never a made-up one.
// Technical: parsed through adminRequestSchema, which only declares safe fields, so the very shape
// proves no hidden column can leak. A wrong id simply resolves to null.

import { describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { InMemoryRequestRepository } from '../service-requests/request.repository';
import { InMemoryCustomerRepository } from '../customers/customer.repository';
import { seedCustomers } from '../customers/fixtures';
import { InMemoryTechnicianRepository } from '../technicians/technician.repository';
import { seedTechnicians } from '../technicians/fixtures';
import { ADMIN_TOKEN, authTestDeps } from '../authentication/testing';
import { seedRequests } from './fixtures';
import { adminRequestDetailSchema, adminRequestSchema } from './request.schema';

function makeApp() {
  return createApp({
    requests: new InMemoryRequestRepository(seedRequests()),
    customers: new InMemoryCustomerRepository(seedCustomers()),
    technicians: new InMemoryTechnicianRepository(seedTechnicians()),
    notifier: { send: async () => {} },
    ...authTestDeps(),
  });
}

// The whole admin surface is admin-role-gated.
const asAdmin = { headers: { authorization: `Bearer ${ADMIN_TOKEN}` } };

describe('GET /api/admin/requests (joined queue)', () => {
  it('returns every job with its customer and assigned technician resolved', async () => {
    const rows = adminRequestSchema.array().parse(await (await makeApp().request('/api/admin/requests', asAdmin)).json());
    expect(rows).toHaveLength(3);

    const intake = rows.find((row) => row.code === 'SL-2026-0001');
    expect(intake?.customer?.name).toBe('Hari Thapa');
    expect(intake?.technician).toBeNull(); // not yet assigned

    const quoted = rows.find((row) => row.code === 'SL-2026-0002');
    expect(quoted?.customer?.name).toBe('Mina Shrestha');
    expect(quoted?.technician?.name).toBe('Ramesh KC');
  });
});

describe('GET /api/admin/requests/:code (joined detail)', () => {
  it('resolves the full join for one job', async () => {
    const response = await makeApp().request('/api/admin/requests/SL-2026-0003', asAdmin);
    expect(response.status).toBe(200);
    const row = adminRequestSchema.parse(await response.json());
    expect(row.customer?.name).toBe('Gita Sharma');
    expect(row.technician?.name).toBe('Bikash Thapa');
  });

  it('404s for an unknown code', async () => {
    expect((await makeApp().request('/api/admin/requests/SL-2026-9999', asAdmin)).status).toBe(404);
  });

  // Business: the detail view's recommendation is DERIVED — online + skilled + fewest live jobs. The
  // fixtures give a verifiable answer: Bikash (0 active) ranks ahead of Ramesh (1 active) for the
  // unassigned washing-machine intake; the offline/AC-only roster members are gone, so only the two
  // washing-machine-capable online techs surface; the assigned AC job gets none.
  it('recommends online skilled technicians ranked by live workload for an unassigned intake', async () => {
    const row = adminRequestDetailSchema.parse(
      await (await makeApp().request('/api/admin/requests/SL-2026-0001', asAdmin)).json(),
    );
    expect(row.recommendedTechnicians.map((tech) => tech.id)).toEqual(['T-2001', 'T-2002']);
    expect(row.recommendedTechnicians[0]?.activeJobs).toBe(0);
    expect(row.recommendedTechnicians[1]?.activeJobs).toBe(1);
    expect(row.recommendedTechnicians[0]?.matchReason).toContain('Washing machine');
  });

  it('recommends nobody once a technician is already assigned', async () => {
    const row = adminRequestDetailSchema.parse(
      await (await makeApp().request('/api/admin/requests/SL-2026-0002', asAdmin)).json(),
    );
    expect(row.recommendedTechnicians).toEqual([]);
  });
});

// Business: The whole urgency path — a customer's tick at submission must survive into the admin's
// Business: one-job view, and an ordinary job must carry NO urgency flag at all (no stored noise).
// Technical: submit through the public POST, then read back through the admin detail join.
describe('urgent flag survives submit → admin detail', () => {
  function submit(body: Record<string, unknown>) {
    return {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    };
  }

  it('surfaces an urgent job on the detail, and none on an ordinary one', async () => {
    const app = makeApp();
    const created = (await (await app.request('/api/requests', submit({
      appliance: 'Washing machine', brand: 'LG', problem: 'Leaking', name: 'Urgent Tester', phone: '9811111111', area: 'Baneshwor', urgent: true,
    }))).json()) as { code: string };

    const urgentDetail = adminRequestDetailSchema.parse(
      await (await app.request(`/api/admin/requests/${created.code}`, asAdmin)).json(),
    );
    expect(urgentDetail.urgent).toBe(true);

    const plain = (await (await app.request('/api/requests', submit({
      appliance: 'Refrigerator', brand: 'Samsung', problem: 'Not cooling', name: 'Plain Tester', phone: '9822222222', area: 'Lalitpur',
    }))).json()) as { code: string };
    const plainDetail = adminRequestDetailSchema.parse(
      await (await app.request(`/api/admin/requests/${plain.code}`, asAdmin)).json(),
    );
    expect(plainDetail.urgent).toBeUndefined();
  });
});
