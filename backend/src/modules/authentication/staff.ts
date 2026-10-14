// Business: the small set of people allowed INTO the admin/technician side — the logins an admin
// Business: creates. Customers never appear here; they are guests who only ever hit public routes.
// Technical: DEMO credentials live in seedStaff() exactly like demo names live in fixtures.ts. This is
// the hardcoded phase; M7 deletes this file's secrets and defers to Supabase Auth (bcrypt, reset,
// lockout are all theirs, not ours to fake here). The PORT is the durable part.

// Business: only these two roles can hold a login; a customer is always a guest.
export type StaffRole = 'admin' | 'technician';

export interface StaffAccount {
  id: string;
  role: StaffRole;
  identifier: string; // the username they sign in with
  secret: string; // demo-only; replaced by Supabase-managed credentials in M7
}

export interface StaffRepository {
  findAll(): Promise<StaffAccount[]>;
  findByIdentifier(identifier: string): Promise<StaffAccount | null>;
  create(account: StaffAccount): Promise<StaffAccount>;
}

export class InMemoryStaffRepository implements StaffRepository {
  private readonly byIdentifier: Map<string, StaffAccount>;

  constructor(seed: StaffAccount[]) {
    this.byIdentifier = new Map(seed.map((account) => [account.identifier, { ...account }]));
  }

  async findAll(): Promise<StaffAccount[]> {
    return [...this.byIdentifier.values()].map((account) => ({ ...account }));
  }

  async findByIdentifier(identifier: string): Promise<StaffAccount | null> {
    const found = this.byIdentifier.get(identifier);
    return found ? { ...found } : null;
  }

  async create(account: StaffAccount): Promise<StaffAccount> {
    this.byIdentifier.set(account.identifier, { ...account });
    return { ...account };
  }
}

// Business: one admin and the two technicians on the live roster, each with a working login. A future
// Business: technician is added to the roster (Supabase) and then provisioned here through POST
// Business: /api/admin/staff, so the create path is exercised for real rather than everything pre-seeded.
export function seedStaff(): StaffAccount[] {
  return [
    { id: 'A-1', role: 'admin', identifier: 'admin', secret: 'sudhar-dev' },
    { id: 'T-2001', role: 'technician', identifier: 'bikash', secret: 'sudhar-dev' },
    { id: 'T-2002', role: 'technician', identifier: 'ramesh', secret: 'sudhar-dev' },
  ];
}
