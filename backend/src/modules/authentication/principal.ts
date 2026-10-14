// Business: WHO the API believes is calling, once a token has been checked. Every guarded action
// Business: reads this instead of trusting anything the caller typed into the body.
// Technical: pure ports. The in-memory verifier below satisfies them today; Supabase Auth / JWT
// satisfies the exact same shapes in M7 without a single route changing.

import type { Role } from '../../../../packages/shared/src/roles';

export interface Principal {
  subject: string; // the account id — for a technician this doubles as their technician id
  role: Role;
}

// Business: turn an opaque bearer token into a trusted principal, or null if it means nothing.
export interface AuthVerifier {
  verify(token: string | undefined): Promise<Principal | null>;
}

// Business: hand out a token that ONLY this store can later recognise, so a made-up string fails.
// Technical: issue/resolve are two halves of one session store; keeping them together is what makes
// the dev tokens real rather than a security theatre the client could forge.
export interface TokenStore {
  issue(principal: Principal): Promise<string>;
  resolve(token: string): Promise<Principal | null>;
}
