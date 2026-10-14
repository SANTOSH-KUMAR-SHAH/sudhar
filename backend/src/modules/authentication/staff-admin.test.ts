// Business: an admin creates a colleague's login (backend.md §3-M), and that login genuinely works —
// Business: the whole point is a technician who had no access can now sign in and see their own slice.
// Business: a taken username is refused, and the credential NEVER comes back in any response body.
// Technical: uses the LIVE session verifier so "create → sign in with it" is real, not a stub.

import { describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { InMemoryRequestRepository } from '../service-requests/request.repository';
import { seedRequests } from '../service-requests/fixtures';
import { InMemoryCustomerRepository } from '../customers/customer.repository';
import { InMemoryTechnicianRepository } from '../technicians/technician.repository';
import { seedTechnicians } from '../technicians/fixtures';
import { InMemorySessionTokens, SessionAuthVerifier } from './session';
import { InMemoryStaffRepository, seedStaff } from './staff';

function makeApp() {
  const tokens = new InMemorySessionTokens();
  const app = createApp({
    requests: new InMemoryRequestRepository(seedRequests()),
    customers: new InMemoryCustomerRepository(),
    // A roster member WITH a technician record but NO login yet — exactly the real case this endpoint
    // exists for (someone added to the team, now being given portal access). Test-local, not shipped.
    technicians: new InMemoryTechnicianRepository([
      ...seedTechnicians(),
      { id: 'T-2003', name: 'Suman Rai', phone: '9818330664', area: 'Maharajgunj', availability: 'online', skills: ['Air conditioner', 'Refrigerator'] },
    ]),
    notifier: { send: async () => {} },
    auth: new SessionAuthVerifier(tokens),
    staff: new InMemoryStaffRepository(seedStaff()),
    tokens,
  });
  return app;
}

function json(body: unknown, token?: string) {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  };
}

async function adminToken(app: ReturnType<typeof makeApp>): Promise<string> {
  const response = await app.request('/api/auth/login', json({ identifier: 'admin', secret: 'sudhar-dev' }));
  return ((await response.json()) as { token: string }).token;
}

const asAdmin = (token: string) => ({ headers: { authorization: `Bearer ${token}` } });

describe('POST /api/admin/staff (provision a login)', () => {
  it('requires an admin', async () => {
    expect((await makeApp().request('/api/admin/staff')).status).toBe(401);
  });

  it('creates a technician login that can then sign in — and never echoes the secret', async () => {
    const app = makeApp();
    const admin = await adminToken(app);

    const created = await app.request(
      '/api/admin/staff',
      json({ identifier: 'suman', role: 'technician', technicianId: 'T-2003', secret: 'sudhar-dev' }, admin),
    );
    expect(created.status).toBe(201);
    const body = (await created.json()) as Record<string, unknown>;
    expect(body).toEqual({ id: 'T-2003', role: 'technician', identifier: 'suman' });
    expect(body).not.toHaveProperty('secret');

    // The freshly created login is real: it can now authenticate.
    const login = await app.request('/api/auth/login', json({ identifier: 'suman', secret: 'sudhar-dev' }));
    expect(login.status).toBe(200);
  });

  it('refuses a username already taken (409), a technician without an id (400), a ghost technician (404)', async () => {
    const app = makeApp();
    const admin = await adminToken(app);

    const duplicate = await app.request('/api/admin/staff', json({ identifier: 'admin', role: 'admin', secret: 'whatever' }, admin));
    expect(duplicate.status).toBe(409);

    const noTechId = await app.request('/api/admin/staff', json({ identifier: 'ghost', role: 'technician', secret: 'whatever' }, admin));
    expect(noTechId.status).toBe(400);

    const badTech = await app.request('/api/admin/staff', json({ identifier: 'nobody', role: 'technician', technicianId: 'T-9999', secret: 'whatever' }, admin));
    expect(badTech.status).toBe(404);
  });
});

describe('GET /api/admin/staff', () => {
  it('lists logins without any secret', async () => {
    const app = makeApp();
    const admin = await adminToken(app);
    const rows = (await (await app.request('/api/admin/staff', asAdmin(admin))).json()) as Record<string, unknown>[];
    expect(rows.map((row) => row.identifier)).toEqual(expect.arrayContaining(['admin', 'bikash', 'ramesh']));
    for (const row of rows) expect(row).not.toHaveProperty('secret');
  });
});
