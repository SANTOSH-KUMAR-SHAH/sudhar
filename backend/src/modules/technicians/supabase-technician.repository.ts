// Business: The technician roster in Supabase. We persist only what is truly stored — who they are and
// Business: whether they are online. Workload stays a live derivation, never a column, so it cannot drift.
// Technical: Implements TechnicianRepository over PostgREST. `skills` is a Postgres text[] which the REST
// API returns as a plain array, so the mapping is direct. setAvailability updates just that one column.

import { PostgrestClient, inFilter, type RestRow } from '../../lib/supabase';
import { NotFoundError } from '../../domain/errors';
import {
  type Availability,
  type TechnicianRecord,
  type TechnicianRepository,
} from './technician.repository';

const TABLE = 'technicians';

function toRecord(row: RestRow): TechnicianRecord {
  const record: TechnicianRecord = {
    id: String(row.id),
    name: String(row.name ?? ''),
    phone: String(row.phone ?? ''),
    area: String(row.area ?? ''),
    availability: (row.availability as Availability) ?? 'offline',
    skills: Array.isArray(row.skills) ? (row.skills as unknown[]).map(String) : [],
  };
  if (row.auth_user_id != null) record.authUserId = String(row.auth_user_id);
  return record;
}

// Technical: Write every column; availability defaults to offline for a brand-new technician until they sign in.
function toRow(record: TechnicianRecord): RestRow {
  return {
    id: record.id,
    name: record.name,
    phone: record.phone,
    area: record.area,
    availability: record.availability,
    skills: record.skills,
    auth_user_id: record.authUserId ?? null,
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

  async findManyByIds(ids: string[]): Promise<TechnicianRecord[]> {
    // Technical: One `id=in.(…)` query for the whole page; an empty page costs no round-trip at all.
    if (ids.length === 0) return [];
    const rows = await this.client.select(TABLE, [`id=${inFilter(ids)}`]);
    return rows.map(toRecord);
  }

  async setAvailability(id: string, availability: Availability): Promise<TechnicianRecord> {
    const updated = await this.client.update(TABLE, [`id=eq.${encodeURIComponent(id)}`], { availability });
    // Mirror the in-memory store: flipping the flag of an unknown technician is a genuine not-found.
    if (!updated) throw new NotFoundError('Technician', id);
    return toRecord(updated);
  }

  async create(record: TechnicianRecord): Promise<TechnicianRecord> {
    const inserted = await this.client.insert(TABLE, toRow(record));
    // The insert echoes the stored row; fall back to the input if the API returned none.
    return inserted ? toRecord(inserted) : record;
  }

  async nextTechnicianCode(): Promise<number> {
    const value = await this.client.rpc<number | string>('next_technician_code');
    return Number(value);
  }
}
