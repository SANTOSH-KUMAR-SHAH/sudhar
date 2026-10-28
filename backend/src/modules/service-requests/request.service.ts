// Business: The read- AND write-side use-cases the screens need. It owns the ORDER of operations
// Business: (make/find the customer, issue a code, open the job, fire the one message) but NOT the
// Business: status rule — that stays inside the aggregate, so no caller can bypass the workflow.
// Technical: Depends only on ports (repositories + notifier + clock). Identical code whether the data
// lives in memory today or Supabase later. It never touches HTTP; routes do that.

import type { RequestQuery, RequestRepository } from './request.repository';
import { customerIdForPhone, type CustomerRecord, type CustomerRepository } from '../customers/customer.repository';
import type { TechnicianRecord, TechnicianRepository } from '../technicians/technician.repository';
import type { RequestCodeNotifier } from '../notifications/request-code-notifier';
import { randomDigits } from '../../lib/random';
import { AuthorizationError, ConflictError, NotFoundError } from '../../domain/errors';
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

// Business: Six random digits behind the year. The code is shown to the customer and read by staff, so it has
// Business: to stay short and typeable — but it can no longer be derived from its neighbour, which is what made
// Business: a known phone number enough to read someone else's job.
const CODE_DIGITS = 6;
const CODE_ATTEMPTS = 5;

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
  // Technical: ONE customers query for the whole page (findManyByIds), not one read per row — the N+1 that used
  // Technical: to multiply every list by its row count, and with it every Workers subrequest budget.
  async jobsForTechnicianView(technicianId: string): Promise<TechnicianJobView[]> {
    const records = await this.list({ technicianId });
    const customers = await this.customersByIds(records.map((record) => record.customerId));
    return records.map((record) => {
      const customer = customers.get(record.customerId) ?? null;
      return {
        ...record,
        customer: customer ? { name: customer.name, phone: customer.phone, area: customer.area } : null,
      };
    });
  }

  // Business: the admin queue/detail — the same records, but each carrying WHO the customer is and
  // Business: WHICH technician is assigned, so no screen has to join ids itself.
  // Technical: Two batched reads (customers, technicians) for the whole page instead of two per row. That is
  // Technical: the difference between 3 subrequests and 601 for a 300-job queue — i.e. staying inside the
  // Technical: Workers limit instead of dying at it.
  async listForAdmin(): Promise<AdminRequestView[]> {
    return this.adminViews(await this.list());
  }

  async detailForAdmin(code: string): Promise<AdminRequestDetailView | null> {
    const record = await this.byCode(code);
    if (!record) return null;
    const [view] = await this.adminViews([record]);
    if (!view) return null;
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
  private async adminViews(records: ServiceRequestRecord[]): Promise<AdminRequestView[]> {
    const technicianIds = records
      .map((record) => record.technicianId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    const [customers, technicians] = await Promise.all([
      this.customersByIds(records.map((record) => record.customerId)),
      this.techniciansByIds(technicianIds),
    ]);
    return records.map((record) => {
      const customer = customers.get(record.customerId) ?? null;
      const technician = record.technicianId ? technicians.get(record.technicianId) ?? null : null;
      return {
        ...record,
        customer: customer ? { name: customer.name, phone: customer.phone, area: customer.area } : null,
        technician: technician ? { name: technician.name, phone: technician.phone } : null,
      };
    });
  }

  private async customersByIds(ids: string[]): Promise<Map<string, CustomerRecord>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const found = await this.deps.customers.findManyByIds(unique);
    return new Map(found.map((customer) => [customer.id, customer]));
  }

  private async techniciansByIds(ids: string[]): Promise<Map<string, TechnicianRecord>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const found = await this.deps.technicians.findManyByIds(unique);
    return new Map(found.map((technician) => [technician.id, technician]));
  }

  // ---- writes ----

  // Business: A customer submits. We reuse-or-create the person by phone, mint a non-guessable code, open the
  // Business: job at NEW_REQUEST, store it, then text the code back — the only automatic message there is.
  // Business: The channel is decided here, never taken from the body: the public POST is always a Website
  // Business: lead (so the SMS fires); a future admin phone-in passes source='Phone' as an argument and
  // Business: suppresses the text, because an admin is already reading the code aloud to the caller.
  async create(input: CreateRequestInput, source: 'Website' | 'Phone' = 'Website'): Promise<ServiceRequestRecord> {
    const at = this.deps.clock();
    const customer = await this.deps.customers.findOrCreate({
      name: input.name,
      phone: input.phone,
      area: input.area,
    });
    const request = await this.openWithUniqueCode(input, customer.id, at, source);

    // Business: A phone-in must NOT text the customer — an admin is on the line reading the code aloud
    // Business: (backend.md §3-L). Only a self-service Website submission fires the one auto message.
    if (source === 'Website') {
      await this.deps.notifier.send({ phone: customer.phone, code: request.code });
    }
    return request.toRecord();
  }

  // Business: Codes are random now, so two submissions can — rarely — land on the same number. The store
  // Business: refuses the second write and we draw again. Five draws over a 900,000-wide space is, for our
  // Business: volume, effectively certain to succeed; if it somehow does not, the caller gets a clean 409 rather
  // Business: than a duplicate row.
  // Technical: The loop is the only place a ServiceRequest is opened, so the retry can never leave a half-built
  // Technical: aggregate or a second timeline behind.
  private async openWithUniqueCode(
    input: CreateRequestInput,
    customerId: string,
    at: string,
    source: 'Website' | 'Phone',
  ): Promise<ServiceRequest> {
    const year = at.slice(0, 4);
    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
      const request = ServiceRequest.open({
        code: formatRequestCode(year, randomDigits(CODE_DIGITS)),
        source,
        customerId,
        appliance: { type: input.appliance, brand: input.brand, model: input.model },
        problem: input.problem,
        visitDate: input.visitDate,
        urgent: input.urgent,
        at,
      });
      try {
        await this.deps.requests.create(request);
        return request;
      } catch (error) {
        if (!(error instanceof ConflictError)) throw error;
      }
    }
    throw new ConflictError('ServiceRequest', 'code allocation');
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

// Business: The friendly reference a customer keeps: SL-<year>-<six random digits>. Still short enough to
// Business: read over the phone, but no longer predictable from the job before it.
function formatRequestCode(year: string, digits: string): string {
  return `SL-${year}-${digits}`;
}
