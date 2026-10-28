// Business: prove the API serves the right jobs, filters correctly, and never ships a malformed record.
// Technical: the whole app is built the same way production builds it (createApp + a repository), then
// driven in-process with app.request(). No network, no server, identical wiring to the Worker.

import { describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { InMemoryRequestRepository } from './request.repository';
import { InMemoryCustomerRepository } from '../customers/customer.repository';
import { InMemoryTechnicianRepository } from '../technicians/technician.repository';
import { seedTechnicians } from '../technicians/fixtures';
import { ADMIN_TOKEN, authTestDeps } from '../authentication/testing';
import { seedRequests } from './fixtures';
import { serviceRequestRecordSchema } from './request.schema';
import type { AppDependencies } from '../../app';

function app(overrides: Partial<AppDependencies> = {}) {
  return createApp({
    requests: new InMemoryRequestRepository(seedRequests()),
    customers: new InMemoryCustomerRepository(),
    technicians: new InMemoryTechnicianRepository(seedTechnicians()),
    notifier: { send: async () => {} },
    ...authTestDeps(),
    ...overrides,
  });
}

// Technician views are staff-gated; these reads present the admin principal.
const asAdmin = { headers: { authorization: `Bearer ${ADMIN_TOKEN}` } };

describe('public job reads are removed (info-disclosure fixed)', () => {
  it('GET /api/requests is no longer served (it was an anonymous whole-queue leak)', async () => {
    const response = await app().request('/api/requests');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not_found' });
  });

  it('GET /api/requests/:code is gone and leaks nothing about a real job', async () => {
    const response = await app().request('/api/requests/SL-2026-0002');
    expect(response.status).toBe(404);
    const body = await response.text();
    // This route used to hand a stranger the technician id, the price and the full internal timeline.
    expect(body).not.toContain('T-2002');
    expect(body).not.toContain('4500');
    expect(body).not.toContain('timeline');
  });
});

describe('POST /api/requests (public submit)', () => {
  const valid = {
    appliance: 'Refrigerator',
    brand: 'LG',
    problem: 'Not cooling',
    name: 'Anita',
    phone: '9812345678',
    area: 'Maharajgunj',
  };
  const post = (body: unknown) => ({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  it('confirms with only the code + status — never internal ids, price or timeline', async () => {
    const response = await app().request('/api/requests', post(valid));
    expect(response.status).toBe(201);
    const body = (await response.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['code', 'status']);
    expect(body.status).toBe('NEW_REQUEST');
  });

  it('drops a spoofed source/actor in the body — a public job is always a Website lead', async () => {
    const response = await app().request('/api/requests', post({ ...valid, source: 'Phone', actor: 'admin' }));
    expect(response.status).toBe(201);
    // Extra keys are ignored; nothing beyond the confirmation is observable to the caller.
    expect(Object.keys(await response.json()).sort()).toEqual(['code', 'status']);
  });

  it('rejects an over-long field (storage/DoS cap) with a stable, detail-free 400', async () => {
    const response = await app().request('/api/requests', post({ ...valid, problem: 'x'.repeat(5000) }));
    expect(response.status).toBe(400);
    // The validation detail (which rule, which value) stays server-side — it is not echoed to the prober.
    expect(await response.json()).toEqual({ error: 'contract_violation' });
  });

  it('refuses an oversized body with 413 before anything is parsed or stored', async () => {
    // Valid JSON, valid fields — only the byte count is abusive. The byte ceiling must fire first.
    const response = await app().request('/api/requests', post({ ...valid, note: 'x'.repeat(20_000) }));
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: 'payload_too_large' });
  });

  it('answers malformed JSON with a clean 400, not a 500', async () => {
    const response = await app().request('/api/requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"appliance":',
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_json' });
  });
});

describe('GET /api/technicians/:id/jobs', () => {
  it('returns only that technician\'s jobs', async () => {
    const response = await app().request('/api/technicians/T-2001/jobs', asAdmin);
    const jobs = serviceRequestRecordSchema.array().parse(await response.json());
    expect(jobs.map((job) => job.code)).toEqual(['SL-2026-0003']);
  });

  it('returns an empty list for a technician with no jobs', async () => {
    const response = await app().request('/api/technicians/T-9999/jobs', asAdmin);
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
