// Business: The read- AND write-side use-cases the screens need. It owns the ORDER of operations
// Business: (make/find the customer, issue a code, open the job, fire the one message) but NOT the
// Business: status rule — that stays inside the aggregate, so no caller can bypass the workflow.
// Technical: Depends only on ports (repositories + notifier + clock). Identical code whether the data
// lives in memory today or Supabase later. It never touches HTTP; routes do that.

import type { RequestQuery, RequestRepository } from './request.repository';
import { customerIdForPhone, type CustomerRepository } from '../customers/customer.repository';
import type { TechnicianRepository } from '../technicians/technician.repository';
import type { RequestCodeNotifier } from '../notifications/request-code-notifier';
import { AuthorizationError, NotFoundError } from '../../domain/errors';
import { isActiveWorkload, type ServiceStatusKey } from '../../../../packages/shared/src/service-status';
import {
  ServiceRequest,
  type ServiceRequestRecord,
  type TransitionOptions,
} from '../../domain/service-request';
import type { Principal } from '../authentication/principal';
import type {
  AdvanceRequestInput,
  AdminRequestDetailView,
  AdminRequestView,
  CreateRequestInput,
  RecommendedTechnicianView,
  TechnicianJobView,
  TrackedRequestView,
  TrackQueryInput,
} from './request.schema';

// Business: A job still needs a technician while it sits in these pre-assignment states; once it is
// Business: ASSIGNED (or beyond) an admin has already chosen someone, so recommendations stop applying.
const ASSIGNABLE_STATUSES: ServiceStatusKey[] = ['NEW_REQUEST', 'UNDER_REVIEW', 'ORDER_CONFIRMED'];

export interface RequestServiceDeps {
  requests: RequestRepository;
  customers: CustomerRepository;
  technicians: TechnicianRepository;
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

  // Business: The technician's own job list, each row joined to the customer it belongs to so the thin
  // Business: portal can show WHO to visit and place the call. Reads only this technician's rows; a
  // Business: customer id that no longer resolves yields null, never a fabricated name.
  // Technical: Reuses the same find-by-technician query and the same nested customer shape as the admin
  // view, so the two audiences can never disagree about a customer's identity.
  async jobsForTechnicianView(technicianId: string): Promise<TechnicianJobView[]> {
    const records = await this.list({ technicianId });
    return Promise.all(
      records.map(async (record) => {
        const customer = await this.deps.customers.findById(record.customerId);
        return {
          ...record,
          customer: customer ? { name: customer.name, phone: customer.phone, area: customer.area } : null,
        };
      }),
    );
  }

  // Business: the admin queue/detail — the same records, but each carrying WHO the customer is and
  // Business: WHICH technician is assigned, so no screen has to join ids itself.
  async listForAdmin(): Promise<AdminRequestView[]> {
    const records = await this.list();
    return Promise.all(records.map((record) => this.toAdminView(record)));
  }

  async detailForAdmin(code: string): Promise<AdminRequestDetailView | null> {
    const record = await this.byCode(code);
    if (!record) return null;
    const view = await this.toAdminView(record);
    const recommendedTechnicians = await this.recommendTechnicians(record);
    return { ...view, recommendedTechnicians };
  }

  // Business: Suggest who could take an as-yet-unassigned job: online right now, skilled on THIS
  // Business: appliance, ranked by fewest live jobs. Everything is read from the roster + the request
  // Business: table — no stored ranking, so it can never contradict the real workload.
  // Technical: Returns [] once a technician is attached or the job is past the assignment stages; the
  // live counts reuse the SAME isActiveWorkload rule the roster uses, so the two screens agree.
  async recommendTechnicians(record: ServiceRequestRecord): Promise<RecommendedTechnicianView[]> {
    if (record.technicianId !== null || !ASSIGNABLE_STATUSES.includes(record.status)) return [];
    const type = record.appliance.type;
    const [technicians, jobs] = await Promise.all([this.deps.technicians.findAll(), this.deps.requests.findAll()]);
    const activeJobsFor = (id: string): number =>
      jobs.filter((job) => job.technicianId === id && isActiveWorkload(job.status)).length;
    return technicians
      .filter((tech) => tech.availability === 'online' && tech.skills.some((skill) => skill.toLowerCase() === type.toLowerCase()))
      .map((tech) => ({
        id: tech.id,
        name: tech.name,
        area: tech.area,
        availability: tech.availability,
        activeJobs: activeJobsFor(tech.id),
      }))
      .sort((a, b) => a.activeJobs - b.activeJobs || a.name.localeCompare(b.name))
      .slice(0, 3)
      .map((tech) => ({ ...tech, matchReason: `${type} specialist · ${tech.activeJobs} live job${tech.activeJobs === 1 ? '' : 's'}` }));
  }

  // Technical: names are READ from the repositories by the stored ids — never recomputed or faked.
  // A customer/technician that no longer resolves yields null rather than a fabricated name.
  private async toAdminView(record: ServiceRequestRecord): Promise<AdminRequestView> {
    const customer = await this.deps.customers.findById(record.customerId);
    const technician = record.technicianId
      ? await this.deps.technicians.findById(record.technicianId)
      : null;
    return {
      ...record,
      customer: customer ? { name: customer.name, phone: customer.phone, area: customer.area } : null,
      technician: technician ? { name: technician.name, phone: technician.phone } : null,
    };
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
      urgent: input.urgent,
      at,
    });

    await this.deps.requests.create(request);
    // Business: A phone-in must NOT text the customer — an admin is on the line reading the code aloud
    // Business: (backend.md §3-L). Only a self-service Website submission fires the one auto message.
    if (input.source === 'Website') {
      await this.deps.notifier.send({ phone: customer.phone, code });
    }
    return request.toRecord();
  }

  // Business: An admin moves a job. Decision 0002: the ADMIN is the sole driver of a customer's status.
  // Business: A technician may ONLY accept (-> TECHNICIAN_CONFIRMED) a job already assigned to them —
  // Business: nothing else. If the workflow or the role forbids the move, we throw and the record is
  // Business: left untouched, so an illegal or unauthorised step can never be persisted.
  async advance(code: string, input: AdvanceRequestInput, principal: Principal): Promise<ServiceRequestRecord> {
    const request = await this.deps.requests.findByCode(code);
    if (!request) throw new NotFoundError('ServiceRequest', code);

    if (principal.role !== 'admin') {
      if (input.to !== 'TECHNICIAN_CONFIRMED') {
        throw new AuthorizationError('forbidden', 'Only an admin may drive this status');
      }
      if (request.technicianId !== principal.subject) {
        throw new AuthorizationError('forbidden', 'You may only accept a job assigned to you');
      }
    }

    const options: TransitionOptions = {};
    if (input.note !== undefined) options.note = input.note;
    // A technician can carry no admin-only fields into the record; only an admin sets assignment/fault/price.
    if (principal.role === 'admin') {
      if (input.technicianId !== undefined) options.technicianId = input.technicianId;
      if (input.fault !== undefined) options.fault = input.fault;
      if (input.price !== undefined) options.price = input.price;
    }

    request.moveTo(input.to, principal.role, this.deps.clock(), options);
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
