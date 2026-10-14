// Business: A signed-in session that OUTLIVES a single Worker. Tokens are still opaque random strings we
// Business: mint — but their DIGEST is stored in Supabase, so a live login survives a restart and a leaked
// Business: row can't be replayed (an attacker without the original token can't rebuild the digest input).
// Technical: Implements the TokenStore port over PostgREST; SessionAuthVerifier (unchanged) verifies against it.
// crypto.randomUUID is native to both the Workers runtime and Node tests, so no uuid dependency is added.

import { PostgrestClient, type RestRow } from '../../lib/supabase';
import type { Role } from '../../../../packages/shared/src/roles';
import type { Principal, TokenStore } from './principal';
import { hashToken } from './password';

const TABLE = 'auth_sessions';

function toPrincipal(row: RestRow): Principal {
  return { subject: String(row.subject), role: row.role as Role };
}

export class SupabaseSessionStore implements TokenStore {
  constructor(private readonly client: PostgrestClient) {}

  async issue(principal: Principal): Promise<string> {
    const token = crypto.randomUUID();
    await this.client.insert(TABLE, {
      token_hash: await hashToken(token),
      subject: principal.subject,
      role: principal.role,
    });
    return token;
  }

  async resolve(token: string): Promise<Principal | null> {
    if (!token) return null;
    const rows = await this.client.select(TABLE, [
      `token_hash=eq.${encodeURIComponent(await hashToken(token))}`,
    ]);
    return rows[0] ? toPrincipal(rows[0]) : null;
  }
}
