// Business: A ServiceRequest is one real job — the "soul" record. Its one iron rule is
// Business: the status may ONLY change along the shared workflow, and every change is
// Business: written to the timeline (who moved it, when). That is the accountability trail.
// Technical: Small aggregate guarding its own invariant. Status is never assigned directly;
// callers go through moveTo(), which validates against packages/shared isValidTransition.

import { isValidTransition, type ServiceStatusKey } from '../../../packages/shared/src/service-status';
import type { Role } from '../../../packages/shared/src/roles';
import { IllegalTransitionError } from './errors';

export type RequestSource = 'Website' | 'Phone';

export interface PriceRecord {
  amount: number;
  currency: 'NPR';
  invoiceNumber?: string;
  paymentStatus: 'Paid' | 'Pending';
}

export interface StatusEvent {
  status: ServiceStatusKey;
  actor: Role;
  at: string;
  note?: string;
}

export interface ServiceRequestRecord {
  code: string;
  status: ServiceStatusKey;
  source: RequestSource;
  customerId: string;
  technicianId: string | null;
  appliance: { type: string; brand: string; model?: string };
  problem: string;
  fault?: string;
  price?: PriceRecord;
  visitDate?: string;
  createdAt: string;
  updatedAt: string;
  timeline: StatusEvent[];
}

export interface NewServiceRequestInput {
  code: string;
  source: RequestSource;
  customerId: string;
  appliance: { type: string; brand: string; model?: string };
  problem: string;
  visitDate?: string;
  at: string;
}

// Side-effects an admin/technician action may carry alongside the status change
// (assigning a person, recording the fault, agreeing a price). Kept explicit on purpose.
export interface TransitionOptions {
  note?: string;
  technicianId?: string | null;
  fault?: string;
  price?: PriceRecord;
}

export class ServiceRequest {
  private constructor(private readonly record: ServiceRequestRecord) {}

  // Business: A brand-new job always opens at NEW_REQUEST, its first timeline event written
  // Business: by whoever raised it (the customer, or an admin typing a phone-in).
  static open(input: NewServiceRequestInput): ServiceRequest {
    const actor: Role = input.source === 'Phone' ? 'admin' : 'customer';
    const event: StatusEvent = { status: 'NEW_REQUEST', actor, at: input.at };
    return new ServiceRequest({
      code: input.code,
      status: 'NEW_REQUEST',
      source: input.source,
      customerId: input.customerId,
      technicianId: null,
      appliance: input.appliance,
      problem: input.problem,
      visitDate: input.visitDate,
      createdAt: input.at,
      updatedAt: input.at,
      timeline: [event],
    });
  }

  // Business: Rehydrate a job from stored data (repository / future database row).
  static fromRecord(record: ServiceRequestRecord): ServiceRequest {
    return new ServiceRequest(structuredClone(record));
  }

  get code(): string {
    return this.record.code;
  }

  get status(): ServiceStatusKey {
    return this.record.status;
  }

  get customerId(): string {
    return this.record.customerId;
  }

  get technicianId(): string | null {
    return this.record.technicianId;
  }

  get source(): RequestSource {
    return this.record.source;
  }

  // Business: "Can this job legally move to X next?" — the read-only form of the rule.
  canMoveTo(to: ServiceStatusKey): boolean {
    return isValidTransition(this.record.status, to);
  }

  // Business: The ONLY way status changes. Rejects anything the workflow forbids, so an
  // Business: illegal move can never corrupt a record no matter what the caller intended.
  moveTo(to: ServiceStatusKey, actor: Role, at: string, options: TransitionOptions = {}): this {
    if (!this.canMoveTo(to)) {
      throw new IllegalTransitionError(this.record.status, to);
    }

    if (options.technicianId !== undefined) this.record.technicianId = options.technicianId;
    if (options.fault !== undefined) this.record.fault = options.fault;
    if (options.price !== undefined) this.record.price = options.price;

    const event: StatusEvent = { status: to, actor, at, note: options.note };
    if (options.note === undefined) delete event.note;

    this.record.status = to;
    this.record.updatedAt = at;
    this.record.timeline.push(event);
    return this;
  }

  // Business: A serialisable copy for persistence — the repository never sees the live object.
  toRecord(): ServiceRequestRecord {
    return structuredClone(this.record);
  }
}
