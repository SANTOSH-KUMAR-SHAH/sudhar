// Business: A customer is identified by their phone number — the same anchor used to track a job later.
// Business: Submitting twice from one phone must NOT create two people; it reuses the same customer.
// Technical: No invariant-rich aggregate here (a phone and a name carry no rules to guard at this
// boundary), so this is a plain record + async port, deliberately lighter than the ServiceRequest
// aggregate. Async now so the Supabase implementation drops in with the exact same shape.

export interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  area: string;
}

export interface NewCustomer {
  name: string;
  phone: string;
  area: string;
}

export interface CustomerRepository {
  findAll(): Promise<CustomerRecord[]>;
  // Business: Resolve a whole page of jobs' customers in ONE read. A list screen must never cost one query
  // Business: per row, or its cost grows with the number of jobs rather than the size of the page.
  findManyByIds(ids: string[]): Promise<CustomerRecord[]>;
  findOrCreate(input: NewCustomer): Promise<CustomerRecord>;
  findByPhone(phone: string): Promise<CustomerRecord | null>;
  findById(id: string): Promise<CustomerRecord | null>;
}

// Business: The phone digits ARE the identity, so the id is derived — one number, one customer, always.
// Business: +977 98… and 98… are the SAME person, so Track can never lock someone out over formatting.
// Technical: Exported so submit (create) and track share one rule; if they ever differed, a customer's
// own code would stop matching their own phone. Normalise by dropping the 977 country prefix.
export function customerIdForPhone(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('977')) digits = digits.slice(3);
  return `C-${digits}`;
}

export class InMemoryCustomerRepository implements CustomerRepository {
  private readonly store = new Map<string, CustomerRecord>();

  // Business: demo requests point at real customers, so the directory and joined views resolve to
  // names, not "unknown". Seeded ids (C-1001…) are distinct from the phone-derived ids that live
  // submissions create, so a real submit can never silently overwrite a seed.
  constructor(seed: CustomerRecord[] = []) {
    for (const record of seed) this.store.set(record.id, { ...record });
  }

  async findAll(): Promise<CustomerRecord[]> {
    return [...this.store.values()].map((record) => ({ ...record }));
  }

  async findManyByIds(ids: string[]): Promise<CustomerRecord[]> {
    // Copies out, and silently skips ids that no longer resolve — the caller renders those as "unknown".
    return ids.flatMap((id) => {
      const record = this.store.get(id);
      return record ? [{ ...record }] : [];
    });
  }

  async findOrCreate(input: NewCustomer): Promise<CustomerRecord> {
    const id = customerIdForPhone(input.phone);
    const existing = this.store.get(id);
    // Returning a copy keeps callers from mutating the store through the object we hand back.
    if (existing) return { ...existing };
    const record: CustomerRecord = { id, name: input.name, phone: input.phone, area: input.area };
    this.store.set(id, record);
    return { ...record };
  }

  async findByPhone(phone: string): Promise<CustomerRecord | null> {
    const record = this.store.get(customerIdForPhone(phone));
    return record ? { ...record } : null;
  }

  async findById(id: string): Promise<CustomerRecord | null> {
    const record = this.store.get(id);
    return record ? { ...record } : null;
  }
}
