// Business: Prove the Supabase job store moves rows faithfully: a stored job comes back as the exact same
// Business: aggregate (nested appliance/price/timeline intact, absent optionality stays absent), the technician
// Business: "my jobs" query asks for the right people and statuses. Codes are drawn at random by the Worker
// Business: (never a database sequence), so a collision — the 409 unique violation — is the retry signal.
// Technical: Runs the real repository over a fake PostgREST fetch, asserting BOTH the mapped object and the
// request we sent, so the snake_case<->camelCase boundary and the query grammar are locked without a live DB.

import { describe, expect, it } from 'vitest';
import { PostgrestClient } from '../../lib/supabase';
import { createFakePostgrest, TEST_CONFIG, type RecordedCall } from '../../lib/postgrest-test-double';
import { ConflictError, NotFoundError } from '../../domain/errors';
import { ServiceRequest } from '../../domain/service-request';
import { SupabaseRequestRepository } from './supabase-request.repository';

function repoFor(handler: (call: RecordedCall) => unknown, status = 200) {
  const { fetchImpl, calls } = createFakePostgrest(handler, status);
  return { repo: new SupabaseRequestRepository(new PostgrestClient(TEST_CONFIG, { fetchImpl })), calls };
}

// A row exactly as PostgREST returns it: snake_case columns, JSONB nested as real objects, NULLs for absents.
const STORED_ROW = {
  code: 'SL-2026-0002',
  status: 'PRICE_APPROVAL',
  source: 'Website',
  customer_id: 'C-1001',
  technician_id: 'T-2002',
  appliance: { type: 'AC', brand: 'LG', model: 'W2' },
  problem: 'not cooling',
  fault: 'capacitor burnt',
  price: { amount: 1500, currency: 'NPR', paymentStatus: 'Pending' },
  visit_date: '2026-10-05 11:00',
  urgent: null,
  created_at: '2026-10-01T09:00+05:45',
  updated_at: '2026-10-02T10:00+05:45',
  timeline: [{ status: 'NEW_REQUEST', actor: 'customer', at: '2026-10-01T09:00+05:45' }],
};

describe('SupabaseRequestRepository.findByCode', () => {
  it('rehydrates the full aggregate from a snake_case row with nested JSONB', async () => {
    const { repo, calls } = repoFor(() => [STORED_ROW]);
    const request = await repo.findByCode('SL-2026-0002');

    expect(request).toBeInstanceOf(ServiceRequest);
    expect(request!.status).toBe('PRICE_APPROVAL');
    expect(request!.technicianId).toBe('T-2002');

    const record = request!.toRecord();
    expect(record.appliance).toEqual({ type: 'AC', brand: 'LG', model: 'W2' });
    expect(record.price).toEqual({ amount: 1500, currency: 'NPR', paymentStatus: 'Pending' });
    expect(record.fault).toBe('capacitor burnt');
    expect(record.visitDate).toBe('2026-10-05 11:00');
    expect(record.timeline).toHaveLength(1);
    // A nullable column that came back NULL must be OMITTED, not stored as `urgent: null` noise.
    expect(record.urgent).toBeUndefined();

    // ...and we asked for exactly this one code.
    expect(calls[0].method).toBe('GET');
    expect(calls[0].url.searchParams.get('code')).toBe('eq.SL-2026-0002');
  });

  it('returns null (and does not fabricate) when the row is absent', async () => {
    const { repo } = repoFor(() => []);
    expect(await repo.findByCode('SL-9999')).toBeNull();
  });
});

describe('SupabaseRequestRepository.findAll', () => {
  it('builds technician and status filters PostgREST understands', async () => {
    const { repo, calls } = repoFor(() => []);
    await repo.findAll({ technicianId: 'T-2001', status: ['ASSIGNED', 'TECHNICIAN_CONFIRMED'] });

    expect(calls[0].url.searchParams.get('technician_id')).toBe('eq.T-2001');
    expect(calls[0].url.searchParams.get('status')).toBe('in.("ASSIGNED","TECHNICIAN_CONFIRMED")');
  });

  it('sends no filter when asked for everything', async () => {
    const { repo, calls } = repoFor(() => [STORED_ROW]);
    const all = await repo.findAll();
    expect(calls[0].url.search).toBe('');
    expect(all).toHaveLength(1);
  });

  it('drops any status not on the whitelist — a service_role query cannot be injected', async () => {
    const { repo, calls } = repoFor(() => []);
    await repo.findAll({
      status: ['CLOSED', '",urgent=is.true",technician_id=like."T-*'] as never,
    });
    // Only the canonical value survives; the injected fragment never reaches the query string.
    expect(calls[0].url.searchParams.get('status')).toBe('in.("CLOSED")');
    expect(calls[0].url.search).not.toContain('urgent');
    expect(calls[0].url.search).not.toContain('like');
  });

  it('sends no status filter when every supplied value is invalid', async () => {
    const { repo, calls } = repoFor(() => []);
    await repo.findAll({ status: ['not-a-status', 'DROP TABLE'] as never });
    expect(calls[0].url.searchParams.get('status')).toBeNull();
  });
});

describe('SupabaseRequestRepository.update', () => {
  it('throws NotFound when no row matched the code', async () => {
    const { repo } = repoFor(() => []);
    const request = ServiceRequest.open({
      code: 'SL-2026-0050',
      source: 'Website',
      customerId: 'C-1001',
      appliance: { type: 'Fridge', brand: 'Haier' },
      problem: 'no cooling',
      at: '2026-10-03T09:00+05:45',
    });
    await expect(repo.update(request)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('SupabaseRequestRepository.create', () => {
  it('maps a 409 unique violation to ConflictError so the service can retry a fresh code', async () => {
    const { repo } = repoFor(() => ({ message: 'duplicate key value', code: '23505' }), 409);
    const request = ServiceRequest.open({
      code: 'SL-2026-445120',
      source: 'Website',
      customerId: 'C-1001',
      appliance: { type: 'Fridge', brand: 'Haier' },
      problem: 'no cooling',
      at: '2026-10-03T09:00+05:45',
    });
    await expect(repo.create(request)).rejects.toBeInstanceOf(ConflictError);
  });
});
