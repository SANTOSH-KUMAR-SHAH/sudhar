// Business: The read- AND write-side use-cases the screens need. It owns the ORDER of operations
// Business: (make/find the customer, issue a code, open the job, fire the one message) but NOT the
// Business: status rule — that stays inside the aggregate, so no caller can bypass the workflow.
// Technical: Depends only on ports (repositories + notifier + clock). Identical code whether the data
// lives in memory today or Supabase later. It never touches HTTP; routes do that.

import type { RequestQuery, RequestRepository } from './request.repository';
import { customerIdForPhone, type CustomerRepository } from '../customers/customer.repository';
import type { RequestCodeNotifier } from '../notifications/request-code-notifier';
import { NotFoundError } from '../../domain/errors';
import {
  ServiceRequest,
  type ServiceRequestRecord,
  type TransitionOptions,
} from '../../domain/service-request';
import type {
  AdvanceRequestInput,
  CreateRequestInput,
  TrackedRequestView,
  TrackQueryInput,
} from './request.schema';

export interface RequestServiceDeps {
  requests: RequestRepository;
  customers: CustomerRepository;
  notifier: RequestCodeNotifier;
  clock: () => string;
}

export class RequestService {
  constructor(private readonly deps: RequestServiceDeps) {}

  // ---- reads ----

  list(query: RequestQuery = {}): Promise<ServiceRequestRecord[]> {
    return this.deps.requests.findAll(query).then((items) => items.map((item) => item.toRecord()));
  }

  byCode(code: string): Promise<ServiceRequestRecord | null> {
    return this.deps.requests.findByCode(code).then((found) => (found ? found.toRecord() : null));
  }

  jobsForTechnician(technicianId: string): Promise<ServiceRequestRecord[]> {
    return this.list({ technicianId });
  }

  // ---- writes ----

  // Business: A customer submits. We reuse-or-create the person by phone, mint the next code, open the
  // Business: job at NEW_REQUEST, store it, then text the code back — the only automatic message there is.
  async create(input: CreateRequestInput): Promise<ServiceRequestRecord> {
    const at = this.deps.clock();
    const customer = await this.deps.customers.findOrCreate({
      name: input.name,
      phone: input.phone,
      area: input.area,
    });
    const sequence = await this.deps.requests.nextSequence();
    const code = formatRequestCode(at.slice(0, 4), sequence);

    const request = ServiceRequest.open({
      code,
      source: input.source,
      customerId: customer.id,
      appliance: { type: input.appliance, brand: input.brand, model: input.model },
      problem: input.problem,
      visitDate: input.visitDate,
      at,
    });

    await this.deps.requests.create(request);
    await this.deps.notifier.send({ phone: customer.phone, code });
    return request.toRecord();
  }

  // Business: An admin moves a job. If the workflow forbids the move, the aggregate throws and the
  // Business: record is left untouched — an illegal step can never be persisted.
  async advance(code: string, input: AdvanceRequestInput): Promise<ServiceRequestRecord> {
    const request = await this.deps.requests.findByCode(code);
    if (!request) throw new NotFoundError('ServiceRequest', code);

    const options: TransitionOptions = {};
    if (input.note !== undefined) options.note = input.note;
    if (input.technicianId !== undefined) options.technicianId = input.technicianId;
    if (input.fault !== undefined) options.fault = input.fault;
    if (input.price !== undefined) options.price = input.price;

    request.moveTo(input.to, input.actor, this.deps.clock(), options);
    await this.deps.requests.update(request);
    return request.toRecord();
  }

  // Business: "Where's my repair?" Needs the phone AND the code. We hand back only the safe slice, and
  // Business: answer identically whether the code is unknown or someone else's — so codes can't be probed.
  async track(input: TrackQueryInput): Promise<TrackedRequestView | null> {
    const request = await this.deps.requests.findByCode(input.code);
    if (!request || request.customerId !== customerIdForPhone(input.phone)) return null;

    const record = request.toRecord();
    const view: TrackedRequestView = {
      code: record.code,
      status: record.status,
      appliance: { type: record.appliance.type, brand: record.appliance.brand },
      problem: record.problem,
      updatedAt: record.updatedAt,
    };
    // Only include the visit date when present; never touch timeline/price/technicianId/customerId.
    if (record.visitDate !== undefined) view.visitDate = record.visitDate;
    return view;
  }
}

// Business: The friendly reference a customer keeps: SL-<year>-<0001..>. Zero-padded, four digits.
function formatRequestCode(year: string, sequence: number): string {
  return `SL-${year}-${String(sequence).padStart(4, '0')}`;
}
