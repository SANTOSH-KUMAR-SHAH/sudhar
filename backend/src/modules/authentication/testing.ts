// Business/Technical: a deterministic verifier for tests and any context that needs a known identity
// without a login round-trip. It is NOT used by the live Worker (index.ts wires SessionAuthVerifier);
// it exists so the guard can be exercised with fixed tokens and fixed roles.

import type { AuthVerifier, Principal } from './principal';
import { InMemorySessionTokens } from './session';
import { InMemoryStaffRepository, seedStaff } from './staff';

export const ADMIN_TOKEN = 'test-admin-token';
export const TECH_TOKEN = 'test-tech-token';

export const ADMIN_PRINCIPAL: Principal = { subject: 'A-1', role: 'admin' };
export const TECH_PRINCIPAL: Principal = { subject: 'T-2001', role: 'technician' };

export class StaticAuthVerifier implements AuthVerifier {
  constructor(private readonly table: Record<string, Principal> = {
    [ADMIN_TOKEN]: ADMIN_PRINCIPAL,
    [TECH_TOKEN]: TECH_PRINCIPAL,
  }) {}

  verify(token: string | undefined): Promise<Principal | null> {
    const found = token ? this.table[token] : undefined;
    return Promise.resolve(found ? { ...found } : null);
  }
}

export function bearer(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

// Business/Technical: the three identity deps every createApp now requires, bundled for tests so a
// suite adds one spread instead of re-wiring a verifier, staff table and token store each time.
export function authTestDeps() {
  return {
    auth: new StaticAuthVerifier(),
    staff: new InMemoryStaffRepository(seedStaff()),
    tokens: new InMemorySessionTokens(),
  };
}
