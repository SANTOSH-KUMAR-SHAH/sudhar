// Business: The store must never hand back data that, if poked, rewrites the real record;
// Business: and a "job that isn't there" must be a loud failure, not a silent success.
// Technical: Exercises the in-memory repository now, so the Supabase repository later has
// the same behaviour contract to satisfy.

import { describe, it, expect } from 'vitest';
import { InMemoryRequestRepository } from './request.repository';
import { seedRequests } from './fixtures';
import { ServiceRequest } from '../../domain/service-request';
import { ConflictError } from '../../domain/errors';

const AT = '2026-10-08T09:00:00.000Z';

function sample(code = 'SL-1'): ServiceRequest {
  return ServiceRequest.open({
    code,
    source: 'Website',
    customerId: 'C-1',
    appliance: { type: 'TV', brand: 'x' },
    problem: 'p',
    at: AT,
  });
}

describe('InMemoryRequestRepository', () => {
  it('creates then reads back by code', async () => {
    const repo = new InMemoryRequestRepository();
    await repo.create(sample());
    const found = await repo.findByCode('SL-1');
    expect(found?.status).toBe('NEW_REQUEST');
  });

  it('returns null for an unknown code', async () => {
    const repo = new InMemoryRequestRepository();
    expect(await repo.findByCode('nope')).toBeNull();
  });

  it('rejects a duplicate code instead of overwriting', async () => {
    const repo = new InMemoryRequestRepository();
    await repo.create(sample());
    // A Conflict (not an overwrite) is what tells the service to draw fresh random digits.
    await expect(repo.create(sample())).rejects.toBeInstanceOf(ConflictError);
  });

  it('persists an update that survives a reload', async () => {
    const repo = new InMemoryRequestRepository();
    const request = sample();
    await repo.create(request);
    request.moveTo('UNDER_REVIEW', 'admin', AT);
    await repo.update(request);
    const reloaded = await repo.findByCode('SL-1');
    expect(reloaded?.status).toBe('UNDER_REVIEW');
    expect(reloaded?.toRecord().timeline).toHaveLength(2);
  });

  it('throws NotFound when updating a job that does not exist', async () => {
    const repo = new InMemoryRequestRepository();
    await expect(repo.update(sample('SL-MISSING'))).rejects.toThrow(/not found/i);
  });

  it('isolates stored data from mutation of a returned aggregate', async () => {
    const repo = new InMemoryRequestRepository();
    await repo.create(sample());
    const copy = await repo.findByCode('SL-1');
    copy!.moveTo('UNDER_REVIEW', 'admin', AT); // mutate the copy, deliberately never saved
    const again = await repo.findByCode('SL-1');
    expect(again?.status).toBe('NEW_REQUEST');
  });

  it('filters by technician and by status', async () => {
    const repo = new InMemoryRequestRepository(seedRequests());
    const forTech = await repo.findAll({ technicianId: 'T-2001' });
    expect(forTech.map((r) => r.code)).toEqual(['SL-2026-0003']);
    const fresh = await repo.findAll({ status: ['NEW_REQUEST'] });
    expect(fresh.map((r) => r.code)).toEqual(['SL-2026-0001']);
  });
});
