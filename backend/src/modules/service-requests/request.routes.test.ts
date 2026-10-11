// Business: prove the API serves the right jobs, filters correctly, and never ships a malformed record.
// Technical: the whole app is built the same way production builds it (createApp + a repository), then
// driven in-process with app.request(). No network, no server, identical wiring to the Worker.

import { describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { InMemoryRequestRepository } from './request.repository';
import { InMemoryCustomerRepository } from '../customers/customer.repository';
import { seedRequests } from './fixtures';
import { serviceRequestRecordSchema } from './request.schema';
import type { AppDependencies } from '../../app';

function app(overrides: Partial<AppDependencies> = {}) {
  return createApp({
    requests: new InMemoryRequestRepository(seedRequests()),
    customers: new InMemoryCustomerRepository(),
    notifier: { send: async () => {} },
    ...overrides,
  });
}

describe('GET /api/requests', () => {
  it('lists every seeded job', async () => {
    const response = await app().request('/api/requests');
    expect(response.status).toBe(200);
    // Parsing through the schema both validates the shape and types the result.
    const items = serviceRequestRecordSchema.array().parse(await response.json());
    expect(items).toHaveLength(3);
  });

  it('filters by a comma-separated status list', async () => {
    const response = await app().request('/api/requests?status=PRICE_APPROVAL');
    const items = serviceRequestRecordSchema.array().parse(await response.json());
    expect(items.map((item) => item.code)).toEqual(['SL-2026-0002']);
  });
});

describe('GET /api/requests/:code', () => {
  it('returns the full job with its timeline', async () => {
    const response = await app().request('/api/requests/SL-2026-0002');
    expect(response.status).toBe(200);
    const record = serviceRequestRecordSchema.parse(await response.json());
    expect(record.status).toBe('PRICE_APPROVAL');
    expect(record.technicianId).toBe('T-2002');
    expect(record.price?.amount).toBe(4500);
    expect(record.timeline).toHaveLength(9);
  });

  it('returns a clean 404 for an unknown code', async () => {
    const response = await app().request('/api/requests/SL-2026-9999');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not_found', code: 'SL-2026-9999' });
  });
});

describe('GET /api/technicians/:id/jobs', () => {
  it('returns only that technician\'s jobs', async () => {
    const response = await app().request('/api/technicians/T-2001/jobs');
    const jobs = serviceRequestRecordSchema.array().parse(await response.json());
    expect(jobs.map((job) => job.code)).toEqual(['SL-2026-0003']);
  });

  it('returns an empty list for a technician with no jobs', async () => {
    const response = await app().request('/api/technicians/T-9999/jobs');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });
});

describe('GET /health', () => {
  it('reports the canonical workflow resolved from shared', async () => {
    const response = await app().request('/health');
    expect(await response.json()).toMatchObject({ status: 'ok', statuses: 17, canConfirmNewRequest: true });
  });
});
