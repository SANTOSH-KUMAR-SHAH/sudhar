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

// Technical: `sha256$<salt>$<digest>` with a digest that is all zeros — a valid shape so verifyCredential takes
// the same hashing path as a real account, and a value that cannot be produced by any password.
const DUMMY_HASH = `sha256$0000000000000000$${'0'.repeat(64)}`;

export class AuthService {
  constructor(
    private readonly staff: StaffRepository,
    private readonly tokens: TokenStore,
  ) {}

  async login(identifier: string, secret: string): Promise<IssuedSession | null> {
    const account = await this.staff.findByIdentifier(identifier);
    // Business: Always spend one credential check, even when the account does not exist. Answering an unknown
    // Business: identifier instantly and a wrong password slowly turns response time into a username oracle.
    // Technical: A fixed, well-formed hash keeps the work identical (one SHA-256) on the miss path. It can never
    // Technical: match, because its salt/digest pair is not derived from any real secret.
    const stored = account?.secret ?? DUMMY_HASH;
    const matches = await verifyCredential(stored, secret);
    if (!account || !matches) return null;

    const token = await this.tokens.issue({ subject: account.id, role: account.role });
    return { token, role: account.role };
  }
}
