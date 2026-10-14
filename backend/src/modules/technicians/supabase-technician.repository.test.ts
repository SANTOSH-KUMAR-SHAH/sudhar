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
