// Business: The staff logins, now in Supabase. We never store a readable password: `create` hashes the secret
// Business: with the shared salted-SHA-256 helper, and reads hand back that hash for `verifyCredential` to check.
// Business: The account's role still comes only from this row — never from what a caller typed — so the guard is unchanged.
// Technical: Implements StaffRepository over PostgREST. The port's `secret` field carries the stored hash here
// (and a plain dev secret in-memory); the login service no longer assumes which, so the shape stays identical.

import { PostgrestClient, type RestRow } from '../../lib/supabase';
import { hashCredential } from './password';
import type { StaffAccount, StaffRepository, StaffRole } from './staff';

const TABLE = 'staff_accounts';

function toAccount(row: RestRow): StaffAccount {
  return {
    id: String(row.id),
    role: row.role as StaffRole,
    identifier: String(row.identifier),
    secret: String(row.secret ?? ''),
  };
}

export class SupabaseStaffRepository implements StaffRepository {
  constructor(private readonly client: PostgrestClient) {}

  async findAll(): Promise<StaffAccount[]> {
    const rows = await this.client.select(TABLE);
    return rows.map(toAccount);
  }

  async findByIdentifier(identifier: string): Promise<StaffAccount | null> {
    const rows = await this.client.select(TABLE, [`identifier=eq.${encodeURIComponent(identifier)}`]);
    return rows[0] ? toAccount(rows[0]) : null;
  }

  async create(account: StaffAccount): Promise<StaffAccount> {
    // Hash at the boundary so the plaintext secret never reaches the database, then hand the caller back
    // the account it passed (mirroring the in-memory store's return), whose secret is not used again.
    await this.client.insert(TABLE, {
      id: account.id,
      role: account.role,
      identifier: account.identifier,
      secret: await hashCredential(account.secret),
    });
    return { ...account };
  }
}
