// Business: Prove the admin "Add Technician" door behaves for real: a valid form creates exactly one technician
// Business: (id minted as T-2003, availability offline) and the response NEVER carries the password or email; a
// Business: duplicate email is a clean 409, an invalid form is a 400, and only an admin may knock. It also proves
// Business: the unit of work — if the roster save fails, the login we just made is undone, so no orphan appears.
// Technical: Same createApp + app.request path as the other route tests, with a recording fake provisioner so no
// live Supabase is touched. StaticAuthVerifier gives a known admin (ADMIN_TOKEN) and technician (TECH_TOKEN).

import { describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { InMemoryRequestRepository } from '../service-requests/request.repository';
import { InMemoryCustomerRepository } from '../customers/customer.repository';
import { seedRequests } from '../service-requests/fixtures';
import { seedCustomers } from '../customers/fixtures';
import { ADMIN_TOKEN, TECH_TOKEN, authTestDeps } from '../authentication/testing';
import { createdTechnicianSchema, type CreateTechnicianInput } from './technician-admin.schema';
import { TechnicianAdminService } from './technician-admin.service';
import { InMemoryTechnicianRepository } from './technician.repository';
import { seedTechnicians } from './fixtures';
import { SupabaseAuthError, type AuthUserProvisioner, type NewAuthUserInput } from '../../lib/supabase-auth';
import type { TechnicianRecord, TechnicianRepository } from './technician.repository';

function adminPost(body: unknown) {
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

const goodInput: CreateTechnicianInput = {
  name: 'Sita Guru',
  phone: '9841902385',
  email: 'sita@sudhar.example',
  area: 'Thamel',
  skills: ['Television'],
  password: 'secret123',
};

// A fake provisioner that records what it was asked to create / delete and can be told to fail on create.
function fakeProvisioner(options: { conflictEmail?: string } = {}) {
  const created: NewAuthUserInput[] = [];
  const deleted: string[] = [];
  const provisioner: AuthUserProvisioner = {
    createUser: async (input) => {
      if (options.conflictEmail && input.email === options.conflictEmail) {
        throw new SupabaseAuthError('that email is already registered', 409);
      }
      created.push(input);
      return `auth-${created.length}`;
    },
    deleteUser: async (userId) => {
      deleted.push(userId);
    },
  };
  return { provisioner, created, deleted };
}

function makeApp(users: AuthUserProvisioner, technicians = new InMemoryTechnicianRepository(seedTechnicians())) {
  return createApp({
    requests: new InMemoryRequestRepository(seedRequests()),
    customers: new InMemoryCustomerRepository(seedCustomers()),
    technicians,
    notifier: { send: async () => {} },
    users,
    ...authTestDeps(),
  });
}

describe('POST /api/admin/technicians', () => {
  it('creates the login + roster row and returns the card with no password or email', async () => {
    const { provisioner, created } = fakeProvisioner();
    const response = await makeApp(provisioner).request('/api/admin/technicians', adminPost(goodInput));

    expect(response.status).toBe(201);
    const json = await response.json();
    const card = createdTechnicianSchema.parse(json);
    expect(card).toMatchObject({ id: 'T-2003', name: 'Sita Guru', availability: 'offline', skills: ['Television'] });

    // Business: the response is a public roster card — the secrets must be absent, not merely unvalidated.
    expect(json).not.toHaveProperty('password');
    expect(json).not.toHaveProperty('email');
    expect(json).not.toHaveProperty('authUserId');

    // The login was minted with the technician's identity riding inside the signed app_metadata.
    expect(created[0]).toMatchObject({ email: 'sita@sudhar.example', password: 'secret123' });
    expect(created[0]?.appMetadata).toEqual({ role: 'technician', technicianId: 'T-2003' });
  });

  it('rejects a duplicate email with 409', async () => {
    const { provisioner } = fakeProvisioner({ conflictEmail: goodInput.email });
    const response = await makeApp(provisioner).request('/api/admin/technicians', adminPost(goodInput));
    expect(response.status).toBe(409);
  });

  it('rejects an empty skills list with 400', async () => {
    const { provisioner } = fakeProvisioner();
    const response = await makeApp(provisioner).request(
      '/api/admin/technicians',
      adminPost({ ...goodInput, skills: [] }),
    );
    expect(response.status).toBe(400);
  });

  it('rejects a too-short password with 400', async () => {
    const { provisioner } = fakeProvisioner();
    const response = await makeApp(provisioner).request(
      '/api/admin/technicians',
      adminPost({ ...goodInput, password: '123' }),
    );
    expect(response.status).toBe(400);
  });

  it('refuses a non-admin caller with 403', async () => {
    const { provisioner } = fakeProvisioner();
    const response = await makeApp(provisioner).request('/api/admin/technicians', techPost(goodInput));
    expect(response.status).toBe(403);
  });
});

describe('TechnicianAdminService — the unit of work', () => {
  it('undoes the just-created login when the roster insert fails (no orphan)', async () => {
    const { provisioner, created, deleted } = fakeProvisioner();
    // A repository whose create always blows up, forcing the rollback path.
    const failing: TechnicianRepository = {
      findAll: async () => [],
      findById: async () => null,
      setAvailability: async () => {
        throw new Error('unused');
      },
      create: async (): Promise<TechnicianRecord> => {
        throw new Error('roster write failed');
      },
      nextTechnicianCode: async () => 2003,
    };

    const service = new TechnicianAdminService(failing, provisioner);
    await expect(
      service.create({ ...goodInput, skills: [...goodInput.skills] }),
    ).rejects.toThrow('roster write failed');

    // The login was made (so we know the id to undo), then deleted again.
    expect(created).toHaveLength(1);
    expect(deleted).toEqual(['auth-1']);
  });
});
