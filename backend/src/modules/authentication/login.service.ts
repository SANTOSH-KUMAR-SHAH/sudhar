// Business: exchange correct credentials for a session token. Wrong or unknown → a single uniform
// Business: "no", so a guesser can't tell a bad username from a bad password.
// Technical: on success we mint a principal from the ACCOUNT (never from the body) and let the token
// store hand back an opaque session token. The secret check is delegated so a hashed (Supabase) or
// plain (dev / in-memory) stored value both verify through one call — the port shape never changes.

import type { Role } from '../../../../packages/shared/src/roles';
import type { TokenStore } from './principal';
import type { StaffRepository } from './staff';
import { verifyCredential } from './password';

export interface IssuedSession {
  token: string;
  role: Role;
}

export class AuthService {
  constructor(
    private readonly staff: StaffRepository,
    private readonly tokens: TokenStore,
  ) {}

  async login(identifier: string, secret: string): Promise<IssuedSession | null> {
    const account = await this.staff.findByIdentifier(identifier);
    if (!account || !(await verifyCredential(account.secret, secret))) return null;

    const token = await this.tokens.issue({ subject: account.id, role: account.role });
    return { token, role: account.role };
  }
}
