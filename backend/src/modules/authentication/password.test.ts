// Business: prove the credential logic both ways — a plain dev secret still signs in, and a stored Supabase
// Business: hash (sha256$salt$hex) also signs in, while a wrong password is refused with no hint which failed.
// Technical: runs the REAL AuthService so login is verified end-to-end, not just the helper in isolation.

import { describe, expect, it } from 'vitest';
import { InMemorySessionTokens } from './session';
import { AuthService } from './login.service';
import { InMemoryStaffRepository, type StaffAccount } from './staff';
import { hashCredential, verifyCredential } from './password';

async function serviceWith(...accounts: StaffAccount[]): Promise<AuthService> {
  return new AuthService(new InMemoryStaffRepository(accounts), new InMemorySessionTokens());
}

describe('verifyCredential', () => {
  it('accepts a plain (dev / in-memory) secret compared directly', async () => {
    expect(await verifyCredential('sudhar-dev', 'sudhar-dev')).toBe(true);
    expect(await verifyCredential('sudhar-dev', 'wrong')).toBe(false);
  });

  it('accepts a hashed secret only for the exact password it was made from', async () => {
    const stored = await hashCredential('hunter2');
    expect(stored.startsWith('sha256$')).toBe(true);
    expect(await verifyCredential(stored, 'hunter2')).toBe(true);
    expect(await verifyCredential(stored, 'hunter3')).toBe(false);
  });

  it('salts, so the same password stores two different hashes that BOTH verify', async () => {
    const a = await hashCredential('same');
    const b = await hashCredential('same');
    expect(a).not.toBe(b);
    expect(await verifyCredential(a, 'same')).toBe(true);
    expect(await verifyCredential(b, 'same')).toBe(true);
  });
});

describe('AuthService.login against a hashed (Supabase-shaped) account', () => {
  it('signs in on the right password and issues a token', async () => {
    const account: StaffAccount = {
      id: 'T-9',
      role: 'technician',
      identifier: 'hashed-tech',
      secret: await hashCredential('right-pass'),
    };
    const session = await (await serviceWith(account)).login('hashed-tech', 'right-pass');
    expect(session?.role).toBe('technician');
    expect(typeof session?.token).toBe('string');
  });

  it('refuses a wrong password and an unknown username with the same null', async () => {
    const account: StaffAccount = {
      id: 'A-9',
      role: 'admin',
      identifier: 'hashed-admin',
      secret: await hashCredential('right-pass'),
    };
    const auth = await serviceWith(account);
    expect(await auth.login('hashed-admin', 'wrong')).toBeNull();
    expect(await auth.login('no-such-user', 'right-pass')).toBeNull();
  });
});
