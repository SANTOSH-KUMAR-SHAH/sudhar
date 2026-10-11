// Business: These tests protect the workflow rules themselves — the money, trust and
// Business: history of a job depend on an illegal status move being impossible.
// Technical: Pure unit tests, no server or DB. Times are fixed so results are deterministic.

import { describe, it, expect } from 'vitest';
import { ServiceRequest } from './service-request';
import { IllegalTransitionError } from './errors';

const AT = '2026-10-08T09:00:00.000Z';

function newRequest(): ServiceRequest {
  return ServiceRequest.open({
    code: 'SL-2026-TEST',
    source: 'Website',
    customerId: 'C-1',
    appliance: { type: 'Refrigerator', brand: 'Samsung' },
    problem: 'Not cooling',
    at: AT,
  });
}

describe('ServiceRequest.open', () => {
  it('starts at NEW_REQUEST with a single customer-authored timeline event', () => {
    const record = newRequest().toRecord();
    expect(record.status).toBe('NEW_REQUEST');
    expect(record.timeline).toHaveLength(1);
    expect(record.timeline[0]).toMatchObject({ status: 'NEW_REQUEST', actor: 'customer' });
  });

  it('credits a phone-in request to the admin who typed it', () => {
    const record = ServiceRequest.open({
      code: 'SL-P',
      source: 'Phone',
      customerId: 'C',
      appliance: { type: 'TV', brand: 'x' },
      problem: 'p',
      at: AT,
    }).toRecord();
    expect(record.timeline[0].actor).toBe('admin');
  });
});

describe('status machine enforcement', () => {
  it('walks the entire happy path and records every step', () => {
    const request = newRequest();
    const path = [
      'UNDER_REVIEW', 'ORDER_CONFIRMED', 'ASSIGNED', 'TECHNICIAN_CONFIRMED',
      'TECHNICIAN_ON_THE_WAY', 'ARRIVED', 'DIAGNOSING', 'PRICE_APPROVAL',
      'IN_PROGRESS', 'COMPLETED', 'INVOICED', 'PAID', 'CLOSED',
    ] as const;
    path.forEach((status) => request.moveTo(status, 'admin', AT));
    expect(request.status).toBe('CLOSED');
    expect(request.toRecord().timeline).toHaveLength(path.length + 1);
  });

  it('rejects an illegal jump and leaves the record completely untouched', () => {
    const request = newRequest();
    expect(() => request.moveTo('COMPLETED', 'admin', AT)).toThrow(IllegalTransitionError);
    expect(request.status).toBe('NEW_REQUEST');
    expect(request.toRecord().timeline).toHaveLength(1);
  });

  it('locks cancellation once the technician is already on the way', () => {
    const request = newRequest();
    (['UNDER_REVIEW', 'ORDER_CONFIRMED', 'ASSIGNED', 'TECHNICIAN_CONFIRMED', 'TECHNICIAN_ON_THE_WAY'] as const).forEach(
      (status) => request.moveTo(status, 'admin', AT),
    );
    expect(request.canMoveTo('CANCELLED')).toBe(false);
    expect(() => request.moveTo('CANCELLED', 'customer', AT)).toThrow(IllegalTransitionError);
  });

  it('cannot move out of a terminal state', () => {
    const request = newRequest();
    request.moveTo('CANCELLED', 'admin', AT);
    expect(request.canMoveTo('ORDER_CONFIRMED')).toBe(false);
    expect(() => request.moveTo('CLOSED', 'admin', AT)).toThrow(IllegalTransitionError);
  });

  it('applies side-effects and records the note on the event', () => {
    const request = newRequest();
    request.moveTo('UNDER_REVIEW', 'admin', AT);
    request.moveTo('ORDER_CONFIRMED', 'admin', AT, { note: 'confirmed by phone' });
    request.moveTo('ASSIGNED', 'admin', AT, { technicianId: 'T-1', note: 'Ramesh KC assigned' });
    const record = request.toRecord();
    expect(record.technicianId).toBe('T-1');
    expect(record.timeline.at(-1)).toMatchObject({ status: 'ASSIGNED', actor: 'admin', note: 'Ramesh KC assigned' });
  });

  it('returns an isolated snapshot so a leaked copy cannot corrupt the source', () => {
    const request = newRequest();
    const snapshot = request.toRecord();
    snapshot.problem = 'tampered';
    snapshot.timeline.push({ status: 'NEW_REQUEST', actor: 'system', at: AT });
    expect(request.toRecord().problem).toBe('Not cooling');
    expect(request.toRecord().timeline).toHaveLength(1);
  });
});
