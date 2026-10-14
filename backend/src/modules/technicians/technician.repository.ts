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
  // Business: The Supabase Auth user this technician signs in as. Optional because demo/offline technicians
  // Business: exist without a login; a real one created through the admin form always carries it.
  authUserId?: string;
}

// A technician being added for real: everything but the id (minted by the store) and availability (starts offline).
export interface NewTechnician {
  name: string;
  phone: string;
  area: string;
  skills: string[];
  authUserId?: string;
}

export interface TechnicianRepository {
  findAll(): Promise<TechnicianRecord[]>;
  findById(id: string): Promise<TechnicianRecord | null>;
  setAvailability(id: string, availability: Availability): Promise<TechnicianRecord>;
  // Business: Persist a brand-new technician. nextTechnicianCode issues the next human id so two adds can't
  // Technical: collide — the Supabase version backs it with a real sequence, mirroring the request codes.
  create(record: TechnicianRecord): Promise<TechnicianRecord>;
  nextTechnicianCode(): Promise<number>;
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

  async create(record: TechnicianRecord): Promise<TechnicianRecord> {
    if (this.store.has(record.id)) throw new Error(`duplicate technician id: ${record.id}`);
    this.store.set(record.id, { ...record, skills: [...record.skills] });
    return { ...record, skills: [...record.skills] };
  }

  async nextTechnicianCode(): Promise<number> {
    // One past the highest existing T-#### (seeds start at 2001, so the first real add is 2003 after 2002).
    let max = 2000;
    for (const id of this.store.keys()) {
      const match = /^T-(\d+)$/.exec(id);
      if (match) max = Math.max(max, Number(match[1]));
    }
    return max + 1;
  }
}
