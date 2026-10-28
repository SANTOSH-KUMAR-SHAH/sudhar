// Business: sign someone in and remember them for the session — nothing more.
// Technical: InMemorySessionTokens issues opaque, unpredictable tokens (crypto.randomUUID, native to
// the Workers runtime — no uuid dependency) and keeps the mapping server-side, so the only tokens that
// ever verify are ones WE handed out. This is a single-node stand-in; M7 replaces the store with Supabase
// sessions/JWT and the AuthVerifier port never changes.

import type { AuthVerifier, Principal, TokenStore } from './principal';

export class InMemorySessionTokens implements TokenStore {
  private readonly sessions = new Map<string, Principal>();
  private readonly expiries = new Map<string, number>();
  // Business: an in-memory token should not live forever — a stolen one would be usable until the process
  // Business: restarts. Bound it to a working session by default (12h) so replay has a hard deadline.
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(options: { ttlMs?: number; now?: () => number } = {}) {
    this.ttlMs = options.ttlMs ?? 12 * 60 * 60_000;
    this.now = options.now ?? (() => Date.now());
  }

  async issue(principal: Principal): Promise<string> {
    const token = crypto.randomUUID();
    this.sessions.set(token, principal);
    this.expiries.set(token, this.now() + this.ttlMs);
    return token;
  }

  async resolve(token: string): Promise<Principal | null> {
    const expiry = this.expiries.get(token);
    if (expiry === undefined || expiry <= this.now()) {
      // Expired (or never issued): drop it entirely so a dead token cannot be resurrected by retry.
      this.sessions.delete(token);
      this.expiries.delete(token);
      return null;
    }
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
