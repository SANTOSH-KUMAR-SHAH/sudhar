// Business: sign someone in and remember them for the session — nothing more.
// Technical: InMemorySessionTokens issues opaque, unpredictable tokens (crypto.randomUUID, native to
// the Workers runtime — no uuid dependency) and keeps the mapping server-side, so the only tokens that
// ever verify are ones WE handed out. This is a single-node stand-in; M7 replaces the store with Supabase
// sessions/JWT and the AuthVerifier port never changes.

import type { AuthVerifier, Principal, TokenStore } from './principal';

export class InMemorySessionTokens implements TokenStore {
  private readonly sessions = new Map<string, Principal>();

  async issue(principal: Principal): Promise<string> {
    const token = crypto.randomUUID();
    this.sessions.set(token, principal);
    return token;
  }

  async resolve(token: string): Promise<Principal | null> {
    return this.sessions.get(token) ?? null;
  }
}

// Business: guards ask one thing — "who is this token?" — and get a principal or nothing.
export class SessionAuthVerifier implements AuthVerifier {
  constructor(private readonly tokens: TokenStore) {}

  verify(token: string | undefined): Promise<Principal | null> {
    if (!token) return Promise.resolve(null);
    return this.tokens.resolve(token);
  }
}
