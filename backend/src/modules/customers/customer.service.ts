// Business: the read-only customer directory the admin browses.
// Technical: thin over the repository — no business rules to hold here yet; search/filtering stays
// a display concern. Supabase adds paging later without changing this call surface.
import type { CustomerRecord, CustomerRepository } from './customer.repository';

export class CustomerService {
  constructor(private readonly customers: CustomerRepository) {}

  list(): Promise<CustomerRecord[]> {
    return this.customers.findAll();
  }

  byId(id: string): Promise<CustomerRecord | null> {
    return this.customers.findById(id);
  }
}
