// Business: the admin directory lists real customers and resolves one by id, so a job screen can
// Business: name the person behind an id without the browser doing any lookup.
// Technical: same createApp + app.request() path; responses parsed through the shared Zod contract.

import { describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { InMemoryRequestRepository } from '../service-requests/request.repository';
import { InMemoryCustomerRepository } from './customer.repository';
import { seedCustomers } from './fixtures';
import { InMemoryTechnicianRepository } from '../technicians/technician.repository';
import { seedTechnicians } from '../technicians/fixtures';
import { ADMIN_TOKEN, authTestDeps } from '../authentication/testing';
import { seedRequests } from '../service-requests/fixtures';
import { customerRecordSchema } from './customer.schema';

function makeApp() {
  return createApp({
    requests: new InMemoryRequestRepository(seedRequests()),
    customers: new InMemoryCustomerRepository(seedCustomers()),
    technicians: new InMemoryTechnicianRepository(seedTechnicians()),
    notifier: { send: async () => {} },
    ...authTestDeps(),
  });
}

// The customer directory is internal — admin-role-gated.
const asAdmin = { headers: { authorization: `Bearer ${ADMIN_TOKEN}` } };

describe('GET /api/customers', () => {
  it('lists the seeded directory', async () => {
    const rows = customerRecordSchema.array().parse(await (await makeApp().request('/api/customers', asAdmin)).json());
    expect(rows.map((row) => row.id)).toContain('C-1001');
    expect(rows.find((row) => row.id === 'C-1001')?.name).toBe('Hari Thapa');
  });
});

describe('GET /api/customers/:id', () => {
  it('resolves one customer', async () => {
    const response = await makeApp().request('/api/customers/C-1002', asAdmin);
    expect(response.status).toBe(200);
    expect(customerRecordSchema.parse(await response.json()).name).toBe('Mina Shrestha');
  });

  it('404s for an unknown customer', async () => {
    expect((await makeApp().request('/api/customers/C-9999', asAdmin)).status).toBe(404);
  });
});
