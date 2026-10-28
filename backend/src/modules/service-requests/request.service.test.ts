// Business: The two guarantees that live in the service layer rather than in a route: a customer's code is drawn
// Business: fresh (and retried on the rare collision) instead of counting up, and a whole admin page is joined in
// Business: a fixed number of reads instead of one per row.
// Technical: The repository ports are faked/counted directly, so the assertions are about HOW MANY calls happen —
// Technical: the N+1 regression is invisible through app.request() alone.

import { describe, expect, it } from 'vitest';
import { RequestService } from './request.service';
import { InMemoryRequestRepository, type RequestRepository } from './request.repository';
import { seedRequests } from './fixtures';
import { InMemoryCustomerRepository } from '../customers/customer.repository';
import { seedCustomers } from '../customers/fixtures';
import { InMemoryTechnicianRepository } from '../technicians/technician.repository';
import { seedTechnicians } from '../technicians/fixtures';
import { ConflictError } from '../../domain/errors';
import type { CreateRequestInput } from './request.schema';

const CLOCK = '2026-10-10T09:30:00+05:45';

const INPUT: CreateRequestInput = {
  appliance: 'Air Conditioner',
  brand: 'LG',
  problem: 'Not cooling',
  name: 'Sita Gurung',
  phone: '9812345678',
  area: 'Baneshwar',
};

function serviceWith(requests: RequestRepository): RequestService {
  return new RequestService({
    requests,
    customers: new InMemoryCustomerRepository(),
    technicians: new InMemoryTechnicianRepository(seedTechnicians()),
    notifier: { send: async () => {} },
    clock: () => CLOCK,
  });
}

// A store that refuses the first `rejections` writes with a Conflict (what a duplicate code looks like).
function collidingRepo(rejections: number): { repo: RequestRepository; attempts: () => number } {
  let attempts = 0;
  const repo: RequestRepository = {
    create: async () => {
      attempts += 1;
      if (attempts <= rejections) throw new ConflictError('ServiceRequest', `SL-taken-${attempts}`);
    },
    update: async () => {},
    findByCode: async () => null,
    findAll: async () => [],
  };
  return { repo, attempts: () => attempts };
}

describe('RequestService.create — random, collision-safe codes', () => {
  it('mints SL-<year>-<six digits> rather than a counter', async () => {
    const service = serviceWith(new InMemoryRequestRepository());
    const created = await service.create(INPUT);
    expect(created.code).toMatch(/^SL-2026-\d{6}$/);
    // The code is the job's public handle; two submits must not share it.
    const second = await service.create({ ...INPUT, problem: 'Second job' });
    expect(second.code).not.toBe(created.code);
  });

  it('draws again when the store reports a collision, and only persists the winner', async () => {
    const { repo, attempts } = collidingRepo(2);
    const created = await serviceWith(repo).create(INPUT);
    expect(created.code).toMatch(/^SL-2026-\d{6}$/);
    expect(attempts()).toBe(3);
  });

  it('gives up with a clean Conflict after the attempt budget instead of looping forever', async () => {
    const { repo, attempts } = collidingRepo(Number.POSITIVE_INFINITY);
    await expect(serviceWith(repo).create(INPUT)).rejects.toBeInstanceOf(ConflictError);
    expect(attempts()).toBe(5);
  });
});

describe('RequestService.listForAdmin — joins are batched (no N+1)', () => {
  it('resolves a whole page with one customers read and one technicians read', async () => {
    let customerBatchCalls = 0;
    let customerByIdCalls = 0;
    let technicianBatchCalls = 0;
    let technicianByIdCalls = 0;

    const customers = new InMemoryCustomerRepository(seedCustomers());
    const technicians = new InMemoryTechnicianRepository(seedTechnicians());
    const countingCustomers = {
      findAll: () => customers.findAll(),
      findOrCreate: (input: Parameters<typeof customers.findOrCreate>[0]) => customers.findOrCreate(input),
      findByPhone: (phone: string) => customers.findByPhone(phone),
      findById: (id: string) => {
        customerByIdCalls += 1;
        return customers.findById(id);
      },
      findManyByIds: (ids: string[]) => {
        customerBatchCalls += 1;
        return customers.findManyByIds(ids);
      },
    };
    const countingTechnicians = {
      findAll: () => technicians.findAll(),
      findById: (id: string) => {
        technicianByIdCalls += 1;
        return technicians.findById(id);
      },
      findManyByIds: (ids: string[]) => {
        technicianBatchCalls += 1;
        return technicians.findManyByIds(ids);
      },
      setAvailability: (id: string, availability: 'online' | 'offline') => technicians.setAvailability(id, availability),
      create: (record: Parameters<typeof technicians.create>[0]) => technicians.create(record),
      nextTechnicianCode: () => technicians.nextTechnicianCode(),
    };

    const service = new RequestService({
      requests: new InMemoryRequestRepository(seedRequests()),
      customers: countingCustomers,
      technicians: countingTechnicians,
      notifier: { send: async () => {} },
      clock: () => CLOCK,
    });

    const views = await service.listForAdmin();

    expect(views).toHaveLength(3);
    // Exactly one batched query per directory — the count must not grow with the number of jobs.
    expect(customerBatchCalls).toBe(1);
    expect(technicianBatchCalls).toBe(1);
    expect(customerByIdCalls).toBe(0);
    expect(technicianByIdCalls).toBe(0);

    // …and the batched data is what each row actually shows.
    const live = views.find((view) => view.code === 'SL-2026-0002');
    expect(live?.customer).toEqual({ name: 'Mina Shrestha', phone: '9802118452', area: 'Lalitpur' });
    expect(live?.technician).toEqual({ name: 'Ramesh KC', phone: '9802778451' });
  });
});
