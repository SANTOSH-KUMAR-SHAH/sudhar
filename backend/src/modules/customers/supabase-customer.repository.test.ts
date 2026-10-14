// Business: The customer directory keys identity on the phone number, so a repeat submit from the same
// Business: phone MUST reuse the existing row instead of creating a second person for one household.
// Technical: Fake PostgREST lets us watch the exact calls — proving the "found" path never inserts and the
// "missing" path derives the phone id, inserts once, and maps the echoed row back to a CustomerRecord.

import { describe, expect, it } from 'vitest';
import { PostgrestClient } from '../../lib/supabase';
import { createFakePostgrest, TEST_CONFIG, type RecordedCall } from '../../lib/postgrest-test-double';
import { customerIdForPhone } from './customer.repository';
import { SupabaseCustomerRepository } from './supabase-customer.repository';

function repoFor(handler: (call: RecordedCall) => unknown) {
  const { fetchImpl, calls } = createFakePostgrest(handler);
  return { repo: new SupabaseCustomerRepository(new PostgrestClient(TEST_CONFIG, { fetchImpl })), calls };
}

describe('SupabaseCustomerRepository.findOrCreate', () => {
  it('reuses an existing customer and never inserts', async () => {
    const phone = '+977 98-1234567';
    const id = customerIdForPhone(phone); // C-981234567, after stripping the country prefix
    const { repo, calls } = repoFor(() => [{ id, name: 'Ram', phone, area: 'Baneshwar' }]);

    const record = await repo.findOrCreate({ name: 'Ram', phone, area: 'Baneshwar' });

    expect(record.id).toBe(id);
    expect(calls).toHaveLength(1); // one lookup, zero writes
    expect(calls[0].method).toBe('GET');
    expect(calls[0].url.searchParams.get('id')).toBe(`eq.${id}`);
  });

  it('inserts the derived id when the phone is new', async () => {
    const phone = '9800000000';
    const id = customerIdForPhone(phone);
    const { repo, calls } = repoFor((call) =>
      call.method === 'GET' ? [] : { id, name: 'Sita', phone, area: 'Putalisadak' },
    );

    const record = await repo.findOrCreate({ name: 'Sita', phone, area: 'Putalisadak' });

    expect(record).toEqual({ id, name: 'Sita', phone, area: 'Putalisadak' });
    const insert = calls.find((c) => c.method === 'POST');
    expect(insert).toBeDefined();
    expect(insert!.body).toEqual({ id, name: 'Sita', phone, area: 'Putalisadak' });
    expect(insert!.prefer).toBe('return=representation');
  });
});
