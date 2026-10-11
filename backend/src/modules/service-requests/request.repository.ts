// Business: This is the ONLY place the app talks to "where jobs live". Services depend on
// Business: the interface, never a concrete store — so swapping memory for Supabase later
// Business: changes one factory line, not the business rules.
// Technical: Methods are async on purpose even though the in-memory version has nothing to
// await: the real (Supabase) repository IS async, and matching the shape now avoids a
// rewrite of every caller when Milestone 7 lands.

import type { ServiceStatusKey } from '../../../../packages/shared/src/service-status';
import { ServiceRequest, type ServiceRequestRecord } from '../../domain/service-request';
import { NotFoundError } from '../../domain/errors';

export interface RequestQuery {
  status?: ServiceStatusKey[];
  technicianId?: string;
}

export interface RequestRepository {
  create(request: ServiceRequest): Promise<void>;
  update(request: ServiceRequest): Promise<void>;
  findByCode(code: string): Promise<ServiceRequest | null>;
  findAll(query?: RequestQuery): Promise<ServiceRequest[]>;
  // Business: Issues the next human-friendly number in SL-YYYY-NNNN. Belongs to the store so the
  // Technical: Supabase version can back it with a real sequence; callers only await a number.
  nextSequence(): Promise<number>;
}

export class InMemoryRequestRepository implements RequestRepository {
  // Business: We persist plain records, and hand out a fresh aggregate on every read, so a
  // Business: caller mutating what it got back can NEVER corrupt the store by accident.
  // Technical: Map keyed by request code; read/write cross the aggregate boundary via
  // toRecord()/fromRecord(), which clone.
  private readonly store = new Map<string, ServiceRequestRecord>();

  constructor(seed: ServiceRequest[] = []) {
    for (const request of seed) {
      this.store.set(request.code, request.toRecord());
    }
  }

  async create(request: ServiceRequest): Promise<void> {
    if (this.store.has(request.code)) {
      throw new Error(`duplicate request code: ${request.code}`);
    }
    this.store.set(request.code, request.toRecord());
  }

  async update(request: ServiceRequest): Promise<void> {
    if (!this.store.has(request.code)) {
      throw new NotFoundError('ServiceRequest', request.code);
    }
    this.store.set(request.code, request.toRecord());
  }

  async findByCode(code: string): Promise<ServiceRequest | null> {
    const record = this.store.get(code);
    return record ? ServiceRequest.fromRecord(record) : null;
  }

  async findAll(query: RequestQuery = {}): Promise<ServiceRequest[]> {
    let matching = [...this.store.values()];
    if (query.technicianId !== undefined) {
      matching = matching.filter((r) => r.technicianId === query.technicianId);
    }
    if (query.status) {
      const allowed = new Set<ServiceStatusKey>(query.status);
      matching = matching.filter((r) => allowed.has(r.status));
    }
    return matching.map((record) => ServiceRequest.fromRecord(record));
  }

  async nextSequence(): Promise<number> {
    // Good enough for a single in-memory instance; the production sequence removes any race.
    return this.store.size + 1;
  }
}
