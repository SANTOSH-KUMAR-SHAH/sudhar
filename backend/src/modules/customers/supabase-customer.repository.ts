// Business: The customer directory living in Supabase. Identity is still the phone number, so the SAME
// Business: derived-id rule the in-memory store uses decides "same person" — a duplicate submit reuses a row.
// Technical: Implements the existing CustomerRepository port over the PostgREST client. Columns are snake_case
// and are mapped here, so no caller above this file ever learns the database's spelling.

import { PostgrestClient, type RestRow } from '../../lib/supabase';
import {
  customerIdForPhone,
  type CustomerRecord,
  type CustomerRepository,
  type NewCustomer,
} from './customer.repository';

const TABLE = 'customers';

function toRecord(row: RestRow): CustomerRecord {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    phone: String(row.phone ?? ''),
    area: String(row.area ?? ''),
  };
}

export class SupabaseCustomerRepository implements CustomerRepository {
  constructor(private readonly client: PostgrestClient) {}

  async findAll(): Promise<CustomerRecord[]> {
    const rows = await this.client.select(TABLE);
    return rows.map(toRecord);
  }

  async findById(id: string): Promise<CustomerRecord | null> {
    const rows = await this.client.select(TABLE, [`id=eq.${encodeURIComponent(id)}`]);
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async findByPhone(phone: string): Promise<CustomerRecord | null> {
    // One phone, one identity: reuse the shared derivation so Track and Submit can never disagree.
    return this.findById(customerIdForPhone(phone));
  }

  async findOrCreate(input: NewCustomer): Promise<CustomerRecord> {
    const id = customerIdForPhone(input.phone);
    const existing = await this.findById(id);
    if (existing) return existing;
    const created = await this.client.insert(TABLE, {
      id,
      name: input.name,
      phone: input.phone,
      area: input.area,
    });
    // The insert echoes the stored row; fall back to the input if the API omitted a column.
    return created ? toRecord(created) : { id, ...input };
  }
}
