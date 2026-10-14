// Business: The technician roster in Supabase. We persist only what is truly stored — who they are and
// Business: whether they are online. Workload stays a live derivation, never a column, so it cannot drift.
// Technical: Implements TechnicianRepository over PostgREST. `skills` is a Postgres text[] which the REST
// API returns as a plain array, so the mapping is direct. setAvailability updates just that one column.

import { PostgrestClient, type RestRow } from '../../lib/supabase';
import { NotFoundError } from '../../domain/errors';
import {
  type Availability,
  type TechnicianRecord,
  type TechnicianRepository,
} from './technician.repository';

const TABLE = 'technicians';

function toRecord(row: RestRow): TechnicianRecord {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    phone: String(row.phone ?? ''),
    area: String(row.area ?? ''),
    availability: (row.availability as Availability) ?? 'offline',
    skills: Array.isArray(row.skills) ? (row.skills as unknown[]).map(String) : [],
  };
}

export class SupabaseTechnicianRepository implements TechnicianRepository {
  constructor(private readonly client: PostgrestClient) {}

  async findAll(): Promise<TechnicianRecord[]> {
    const rows = await this.client.select(TABLE);
    return rows.map(toRecord);
  }

  async findById(id: string): Promise<TechnicianRecord | null> {
    const rows = await this.client.select(TABLE, [`id=eq.${encodeURIComponent(id)}`]);
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async setAvailability(id: string, availability: Availability): Promise<TechnicianRecord> {
    const updated = await this.client.update(TABLE, [`id=eq.${encodeURIComponent(id)}`], { availability });
    // Mirror the in-memory store: flipping the flag of an unknown technician is a genuine not-found.
    if (!updated) throw new NotFoundError('Technician', id);
    return toRecord(updated);
  }
}
