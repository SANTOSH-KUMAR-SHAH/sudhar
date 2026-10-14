// Business: an admin gives a colleague access. We refuse a username already taken, and a technician
// Business: login must reference a technician who actually exists — otherwise "accept only your own
// Business: jobs" would point at nobody. Nothing here is a status change; it is pure access.
// Technical: depends on the staff + technician ports. Real credential hashing/invite/reset is Supabase
// Auth's job in M7; this is the hardcoded stand-in that honours the same rules.

import { ConflictError, NotFoundError } from '../../domain/errors';
import type { TechnicianRepository } from '../technicians/technician.repository';
import type { StaffAccount, StaffRepository } from './staff';
import type { StaffProvisionInput, StaffSummary } from './staff-admin.schema';

function toSummary(account: StaffAccount): StaffSummary {
  return { id: account.id, role: account.role, identifier: account.identifier };
}

export class StaffAdminService {
  constructor(
    private readonly staff: StaffRepository,
    private readonly technicians: TechnicianRepository,
  ) {}

  async list(): Promise<StaffSummary[]> {
    const accounts = await this.staff.findAll();
    return accounts.map(toSummary);
  }

  async provision(input: StaffProvisionInput): Promise<StaffSummary> {
    if (await this.staff.findByIdentifier(input.identifier)) {
      throw new ConflictError('Login', input.identifier);
    }

    let id: string;
    if (input.role === 'technician') {
      // The schema guarantees technicianId is present for a technician login.
      id = input.technicianId as string;
      const technician = await this.technicians.findById(id);
      if (!technician) throw new NotFoundError('Technician', id);
    } else {
      id = await this.nextAdminId();
    }

    const account: StaffAccount = { id, role: input.role, identifier: input.identifier, secret: input.secret };
    const created = await this.staff.create(account);
    return toSummary(created);
  }

  // Business: admin logins aren't tied to a technician, so we hand out the next free A-<n>.
  private async nextAdminId(): Promise<string> {
    const accounts = await this.staff.findAll();
    const highest = accounts
      .filter((account) => account.id.startsWith('A-'))
      .reduce((max, account) => Math.max(max, Number(account.id.slice(2)) || 0), 0);
    return `A-${highest + 1}`;
  }
}
