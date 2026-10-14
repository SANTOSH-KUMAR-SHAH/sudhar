// Business: The technician roster — who is on the team and whether they are online right now. Admin
// Business: assigns by hand, so all we store is availability; how busy someone is is derived from their
// Business: live jobs, never a number we keep by hand (it would drift the moment a job moved).
// Technical: Like Customer, a technician has no status machine to guard, so this is a plain record +
// async port (no aggregate ceremony). Async now so the Supabase repository drops in unchanged.

import { NotFoundError } from '../../domain/errors';

export type Availability = 'online' | 'offline';

export interface TechnicianRecord {
  id: string;
  name: string;
  phone: string;
  area: string;
  availability: Availability;
  skills: string[];
}

export interface TechnicianRepository {
  findAll(): Promise<TechnicianRecord[]>;
  findById(id: string): Promise<TechnicianRecord | null>;
  setAvailability(id: string, availability: Availability): Promise<TechnicianRecord>;
}

export class InMemoryTechnicianRepository implements TechnicianRepository {
  private readonly store = new Map<string, TechnicianRecord>();

  constructor(seed: TechnicianRecord[] = []) {
    for (const technician of seed) {
      this.store.set(technician.id, { ...technician });
    }
  }

  async findAll(): Promise<TechnicianRecord[]> {
    // Copies out, so a caller can never mutate the store through what it received.
    return [...this.store.values()].map((record) => ({ ...record, skills: [...record.skills] }));
  }

  async findById(id: string): Promise<TechnicianRecord | null> {
    const record = this.store.get(id);
    return record ? { ...record, skills: [...record.skills] } : null;
  }

  async setAvailability(id: string, availability: Availability): Promise<TechnicianRecord> {
    const record = this.store.get(id);
    if (!record) throw new NotFoundError('Technician', id);
    const updated: TechnicianRecord = { ...record, availability };
    this.store.set(id, updated);
    return { ...updated, skills: [...updated.skills] };
  }
}
