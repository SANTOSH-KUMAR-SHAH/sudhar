// Business: Admin toggling a technician online/offline writes exactly that one column. If the technician id
// Business: is unknown, the store refuses (a genuine not-found) rather than silently "succeeding" on nothing.
// Technical: Fake PostgREST checks we PATCH only `availability` on the right row, map the skills array back,
// and translate an empty update result into the same NotFoundError the in-memory store throws.

import { describe, expect, it } from 'vitest';
import { PostgrestClient } from '../../lib/supabase';
import { createFakePostgrest, TEST_CONFIG, type RecordedCall } from '../../lib/postgrest-test-double';
import { NotFoundError } from '../../domain/errors';
import { SupabaseTechnicianRepository } from './supabase-technician.repository';

function repoFor(handler: (call: RecordedCall) => unknown) {
  const { fetchImpl, calls } = createFakePostgrest(handler);
  return { repo: new SupabaseTechnicianRepository(new PostgrestClient(TEST_CONFIG, { fetchImpl })), calls };
}

describe('SupabaseTechnicianRepository.setAvailability', () => {
  it('patches only availability and maps the stored row back', async () => {
    const stored = { id: 'T-2001', name: 'Bikash', phone: '9811111111', area: 'Baneshwar', availability: 'online', skills: ['AC', 'Fridge'] };
    const { repo, calls } = repoFor(() => [stored]);

    const record = await repo.setAvailability('T-2001', 'online');

    expect(calls[0].method).toBe('PATCH');
    expect(calls[0].url.searchParams.get('id')).toBe('eq.T-2001');
    expect(calls[0].body).toEqual({ availability: 'online' });
    expect(record.availability).toBe('online');
    expect(record.skills).toEqual(['AC', 'Fridge']);
  });

  it('throws NotFound when the technician row does not exist', async () => {
    const { repo } = repoFor(() => []);
    await expect(repo.setAvailability('T-9999', 'offline')).rejects.toBeInstanceOf(NotFoundError);
  });
});

// Business: Adding a technician for real writes EVERY column we own — including the auth_user_id link that lets
// Business: them sign in — and reads the stored row back, so the id/defaults the DB filled in are honoured.
// Technical: The fake PostgREST asserts a POST to /technicians with a representation preference and the mapped
// snake_case body; the echoed row (with auth_user_id) must map back onto the record's authUserId.
describe('SupabaseTechnicianRepository.create', () => {
  it('inserts the full row (incl. auth_user_id) and maps the stored copy back', async () => {
    const stored = { id: 'T-2003', name: 'Sita', phone: '9841902385', area: 'Thamel', availability: 'offline', skills: ['Television'], auth_user_id: 'uuid-9' };
    const { repo, calls } = repoFor(() => [stored]);

    const record = await repo.create({
      id: 'T-2003', name: 'Sita', phone: '9841902385', area: 'Thamel', availability: 'offline', skills: ['Television'], authUserId: 'uuid-9',
    });

    expect(calls[0].method).toBe('POST');
    expect(calls[0].url.pathname).toBe('/rest/v1/technicians');
    expect(calls[0].prefer).toBe('return=representation');
    expect(calls[0].body).toEqual({
      id: 'T-2003', name: 'Sita', phone: '9841902385', area: 'Thamel', availability: 'offline', skills: ['Television'], auth_user_id: 'uuid-9',
    });
    expect(record.authUserId).toBe('uuid-9');
  });

  it('writes a null auth_user_id for a technician without a login (offline demo add)', async () => {
    const { repo, calls } = repoFor(() => []);
    await repo.create({ id: 'T-2004', name: 'No Login', phone: '9841902385', area: 'Baneshwar', availability: 'offline', skills: [] });
    expect(calls[0].body).toMatchObject({ auth_user_id: null });
  });
});

// Business: The next friendly technician number comes from the database sequence (exactly one per call), so two
// Business: admins adding at once can never mint the same id. Technical: it is a volatile RPC, not a cached read.
describe('SupabaseTechnicianRepository.nextTechnicianCode', () => {
  it('calls the sequence function and coerces the scalar to a number', async () => {
    const { repo, calls } = repoFor(() => 2003);
    expect(await repo.nextTechnicianCode()).toBe(2003);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url.pathname).toBe('/rest/v1/rpc/next_technician_code');
  });
});
