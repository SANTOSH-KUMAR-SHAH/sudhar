// Business: The one action that adds a colleague for real: mint their technician id, open a Supabase login for
// Business: them (email + password they will sign in with), and save their roster row — all as a unit. If the
// Business: roster can't be saved we undo the login, so we never leave a person who can sign in but owns nothing.
// Technical: Depends only on the technician store port and the injected AuthUserProvisioner, so it is testable
// Business: with a fake and needs no live Supabase. A taken email surfaces as a domain conflict (the API turns it
// Business: into a clean 409), never a raw provider error.

import { ConflictError } from '../../domain/errors';
import { SupabaseAuthError, type AuthUserProvisioner } from '../../lib/supabase-auth';
import type { TechnicianRecord, TechnicianRepository } from './technician.repository';
import type { CreateTechnicianInput } from './technician-admin.schema';

function formatTechnicianId(code: number): string {
  return `T-${String(code).padStart(4, '0')}`;
}

export class TechnicianAdminService {
  constructor(
    private readonly technicians: TechnicianRepository,
    private readonly users: AuthUserProvisioner,
  ) {}

  async create(input: CreateTechnicianInput): Promise<TechnicianRecord> {
    const id = formatTechnicianId(await this.technicians.nextTechnicianCode());

    let authUserId: string;
    try {
      authUserId = await this.users.createUser({
        email: input.email,
        password: input.password,
        // Ride inside the signed token so the Worker can read role + technician id without another lookup.
        appMetadata: { role: 'technician', technicianId: id },
      });
    } catch (error) {
      if (error instanceof SupabaseAuthError && error.status === 409) {
        throw new ConflictError('Login', input.email);
      }
      throw error;
    }

    try {
      return await this.technicians.create({
        id,
        name: input.name,
        phone: input.phone,
        area: input.area,
        availability: 'offline',
        skills: [...input.skills],
        authUserId,
      });
    } catch (error) {
      // Business: Undo the login we just made. If the undo itself fails we must NOT hide it — an auth account
      // Business: with no roster row can still sign in and owns nothing, so an operator has to be told which id
      // Business: to remove by hand. The original failure (the reason we are rolling back) is what we rethrow.
      try {
        await this.users.deleteUser(authUserId);
      } catch (cleanupError) {
        console.error('[technician-admin] orphaned auth user (delete failed):', authUserId, cleanupError);
      }
      throw error;
    }
  }
}
