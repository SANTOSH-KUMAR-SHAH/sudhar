// Business: The central job record stored in Supabase. The whole aggregate — status, nested appliance,
// Business: price and the full timeline — is saved as real JSON so rehydrating it gives back the exact same
// Business: ServiceRequest the in-memory store would. Nothing about the state machine lives here; we only move rows.
// Technical: Implements RequestRepository over PostgREST. Column names are snake_case; the aggregate's camelCase
// record is mapped at this one boundary. Codes are random (see lib/random), never a counter, so a code
// cannot be guessed from its neighbour; a unique collision is surfaced as a ConflictError for retry.

import { PostgrestClient, SupabaseError, inFilter, type RestRow } from '../../lib/supabase';
import { isServiceStatus, type ServiceStatusKey } from '../../../../packages/shared/src/service-status';
import { ConflictError, NotFoundError } from '../../domain/errors';
import { ServiceRequest, type ServiceRequestRecord } from '../../domain/service-request';
import type { RequestQuery, RequestRepository } from './request.repository';

const TABLE = 'requests';

// Business: Turn a stored row back into the domain record, keeping the optionality the aggregate expects:
// Business: a nullable column that is null/absent must be OMITTED from the record, not stored as null noise.
function rowToRecord(row: RestRow): ServiceRequestRecord {
  const record: ServiceRequestRecord = {
    code: String(row.code),
    status: row.status as ServiceStatusKey,
    source: row.source as ServiceRequestRecord['source'],
    customerId: String(row.customer_id),
    technicianId: row.technician_id == null ? null : String(row.technician_id),
    appliance: row.appliance as ServiceRequestRecord['appliance'],
    problem: String(row.problem ?? ''),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    timeline: (row.timeline as ServiceRequestRecord['timeline']) ?? [],
  };
  if (row.fault != null) record.fault = String(row.fault);
  if (row.price != null) record.price = row.price as ServiceRequestRecord['price'];
  if (row.visit_date != null) record.visitDate = String(row.visit_date);
  if (row.urgent === true) record.urgent = true;
  return record;
}

// Technical: The inverse — write every column, using NULL for the fields the record leaves absent.
function recordToRow(record: ServiceRequestRecord): RestRow {
  return {
    code: record.code,
    status: record.status,
    source: record.source,
    customer_id: record.customerId,
    technician_id: record.technicianId,
    appliance: record.appliance,
    problem: record.problem,
    fault: record.fault ?? null,
    price: record.price ?? null,
    visit_date: record.visitDate ?? null,
    urgent: record.urgent ?? null,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    timeline: record.timeline,
  };
}

export class SupabaseRequestRepository implements RequestRepository {
  constructor(private readonly client: PostgrestClient) {}

  async create(request: ServiceRequest): Promise<void> {
    try {
      await this.client.insert(TABLE, recordToRow(request.toRecord()));
    } catch (error) {
      // Business: 409 is Postgres telling us the code is already taken (unique violation). That is not a
      // Business: server fault — the service retries with fresh random digits, exactly as the memory store does.
      if (error instanceof SupabaseError && error.status === 409) {
        throw new ConflictError('ServiceRequest', request.code);
      }
      throw error;
    }
  }

  async update(request: ServiceRequest): Promise<void> {
    const record = request.toRecord();
    const updated = await this.client.update(TABLE, [`code=eq.${encodeURIComponent(record.code)}`], recordToRow(record));
    if (!updated) throw new NotFoundError('ServiceRequest', record.code);
  }

  async findByCode(code: string): Promise<ServiceRequest | null> {
    const rows = await this.client.select(TABLE, [`code=eq.${encodeURIComponent(code)}`]);
    return rows[0] ? ServiceRequest.fromRecord(rowToRecord(rows[0])) : null;
  }

  async findAll(query: RequestQuery = {}): Promise<ServiceRequest[]> {
    const filters: string[] = [];
    if (query.technicianId !== undefined) {
      filters.push(`technician_id=eq.${encodeURIComponent(query.technicianId)}`);
    }
    // Security: this query runs under the service_role key (it bypasses RLS), so a status value must NEVER
    // reach PostgREST as raw text — an injected `",x=like."*` would widen the filter to rows the caller has
    // no right to read. We keep ONLY values on the canonical status whitelist; anything else is dropped, so
    // the in.() list is assembled exclusively from known-safe enum strings that need no escaping.
    const safeStatus = (query.status ?? []).filter(isServiceStatus);
    if (safeStatus.length > 0) {
      filters.push(`status=${inFilter(safeStatus)}`);
    }
    const rows = await this.client.select(TABLE, filters);
    return rows.map((row) => ServiceRequest.fromRecord(rowToRecord(row)));
  }
}
