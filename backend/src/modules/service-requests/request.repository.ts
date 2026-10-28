// Business: This is the ONLY place the app talks to "where jobs live". Services depend on
// Business: the interface, never a concrete store — so swapping memory for Supabase later
// Business: changes one factory line, not the business rules.
// Technical: Methods are async on purpose even though the in-memory version has nothing to
// await: the real (Supabase) repository IS async, and matching the shape now avoids a
// rewrite of every caller when Milestone 7 lands.

import type { ServiceStatusKey } from '../../../../packages/shared/src/service-status';
import { ServiceRequest, type ServiceRequestRecord } from '../../domain/service-request';
import { ConflictError, NotFoundError } from '../../domain/errors';

export interface RequestQuery {
  status?: ServiceStatusKey[];
  technicianId?: string;
}

export interface RequestRepository {
  create(request: ServiceRequest): Promise<void>;
  update(request: ServiceRequest): Promise<void>;
  findByCode(code: string): Promise<ServiceRequest | null>;
  findAll(query?: RequestQuery): Promise<ServiceRequest[]>;
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
    // Business: A code is a public handle, so two jobs may never share one. The store refuses the second
    // Business: write instead of overwriting — the caller then retries with fresh random digits.
    if (this.store.has(request.code)) {
      throw new ConflictError('ServiceRequest', request.code);
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
}
