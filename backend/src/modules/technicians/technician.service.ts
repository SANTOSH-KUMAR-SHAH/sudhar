// Business: The roster and availability use-cases. A technician's workload is not a stored number — it
// Business: is counted live from the jobs actually assigned to them, so it can never lie.
// Technical: Depends only on the technician + request repository ports. "Active" (a job still in
// Business: flight, neither finished nor cancelled) comes from the SHARED status group, now that a
// Business: second caller (the admin recommendation ranking) needs the exact same category — no drift.

import { isActiveWorkload } from '../../../../packages/shared/src/service-status';
import type { RequestRepository } from '../service-requests/request.repository';
import type { Availability, TechnicianRecord, TechnicianRepository } from './technician.repository';
import type { TechnicianRosterView } from './technician.schema';

export class TechnicianService {
  constructor(
    private readonly technicians: TechnicianRepository,
    private readonly requests: RequestRepository,
  ) {}

  async roster(): Promise<TechnicianRosterView[]> {
    const [people, jobs] = await Promise.all([this.technicians.findAll(), this.requests.findAll()]);
    return people.map((person) => ({
      ...person,
      activeJobs: jobs.filter((job) => job.technicianId === person.id && isActiveWorkload(job.status)).length,
    }));
  }

  getById(id: string): Promise<TechnicianRecord | null> {
    return this.technicians.findById(id);
  }

  setAvailability(id: string, availability: Availability): Promise<TechnicianRecord> {
    return this.technicians.setAvailability(id, availability);
  }
}
