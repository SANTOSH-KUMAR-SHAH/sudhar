// Business: Turn a Supabase-issued access token into a trusted Principal — or null, meaning "go away". This
// Business: REPLACES our opaque-token store: we no longer hand out tokens, Supabase does. The role and (for a
// Business: technician) the technician id ride inside the SIGNED app_metadata, so a caller cannot forge them and
// Business: we need no second database read to know who is calling. Everything above this file is unchanged.
// Technical: Verifies the RS256 signature against the project's cached JWKS via WebCrypto (importKey + verify),
// then checks issuer / audience / expiry. Any failure — bad signature, unknown kid, wrong aud, expired — is a
// null, never a thrown error, so the guard cleanly answers 401. fetchImpl + clock are injectable for tests.

import type { AuthVerifier, Principal } from './principal';
import type { Role } from '../../../../packages/shared/src/roles';
import { decodeJwt, isExpired, type JwtClaims } from '../../lib/jwt';
import { fetchJwks, type JsonWebKeyRecord } from '../../lib/supabase-auth';

// Supabase tags every access token with this audience; anything else wasn't issued for our API.
const EXPECTED_AUDIENCE = 'authenticated';
const KEY_CACHE_MS = 5 * 60_000;
// Business: When the JWKS cannot be fetched, keep serving the last known-good keys (they do not expire just
// Business: because a request failed) and retry soon instead of caching the failure for the full key window.
const KEY_RETRY_MS = 30_000;
// Business: A Supabase access token lives ~1h; a refresh token lives for weeks. If a refresh token could be
// Business: replayed here as a bearer credential, one stolen value would buy an attacker months of access.
// Technical: reject any verified token whose validity window (exp - iat) exceeds this — 2h is generous
// headroom over the 1h access token but far under a refresh token, so the long-lived one simply fails.
const MAX_TOKEN_TTL_SECONDS = 2 * 60 * 60;

function isStaffRole(value: unknown): value is Role {
  return value === 'admin' || value === 'technician';
}

// Technical: WebCrypto only accepts the standard JWK members; Supabase's JWKS ships extra fields (kid/use/alg)
// that importKey rejects, so we hand it a trimmed { kty, n, e } and remember the kid alongside the key.
async function importSigningKey(jwk: JsonWebKeyRecord): Promise<CryptoKey | null> {
  if (jwk.kty !== 'RSA' || !jwk.n || !jwk.e) return null;
  try {
    return await crypto.subtle.importKey(
      'jwk',
      { kty: 'RSA', n: jwk.n, e: jwk.e } as JsonWebKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
  } catch {
    return null;
  }
}

export interface SupabaseJwtVerifierDeps {
  fetchImpl?: typeof globalThis.fetch;
  now?: () => number; // epoch milliseconds
}

export class SupabaseJwtVerifier implements AuthVerifier {
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly now: () => number;
  private keys: Map<string, CryptoKey> | null = null;
  private keysFetchedAt = 0;
  // Technical: Throttles a forced refresh (unknown kid) and a retry after a failed fetch, so neither can be
  // Technical: driven by an attacker sending junk tokens or by Supabase being briefly unavailable.
  private retryAt = 0;
  private forcedAt = 0;
  private inflight: Promise<void> | null = null;

  constructor(
    private readonly url: string,
    deps: SupabaseJwtVerifierDeps = {},
  ) {
    this.fetchImpl = deps.fetchImpl ?? globalThis.fetch;
    this.now = deps.now ?? (() => Date.now());
  }

  async verify(token: string | undefined): Promise<Principal | null> {
    if (!token) return null;
    const decoded = decodeJwt(token);
    if (!decoded) return null;
    if (decoded.header.alg !== 'RS256') return null;
    // Business: A bearer credential with no stated expiry is not a short-lived access token. Treating a missing
    // Business: `exp` as "never expires" is the wrong default for the one value that bounds how long a stolen
    // Business: token stays useful, so it is refused outright.
    if (typeof decoded.payload.exp !== 'number') return null;
    if (isExpired(decoded.payload, Math.floor(this.now() / 1000))) return null;

    const issuer = `${this.url.replace(/\/$/, '')}/auth/v1`;
    if (decoded.payload.iss !== issuer || decoded.payload.aud !== EXPECTED_AUDIENCE) return null;

    // Business: Honour only short-lived ACCESS tokens. A refresh token — flagged by a refresh type/token_use
    // Business: claim, or revealed by an oversized validity window — is refused, so stealing it cannot mint access.
    // Technical: the claim check is purely additive (reject ONLY what clearly says refresh) so a valid access
    // token using any wording ("access", "access_token", or none at all) is never falsely rejected.
    const { exp, iat } = decoded.payload;
    if (typeof exp === 'number' && typeof iat === 'number' && exp - iat > MAX_TOKEN_TTL_SECONDS) return null;
    const tokenType = decoded.payload.type ?? decoded.payload.token_use;
    if (typeof tokenType === 'string' && /refresh/i.test(tokenType)) return null;

    if (!(await this.verifySignature(decoded.header.kid, decoded.data, decoded.signature))) return null;

    return this.principalFromClaims(decoded.payload);
  }

  private async verifySignature(kid: string | undefined, data: string, signature: Uint8Array): Promise<boolean> {
    const key = await this.signingKey(kid);
    if (!key) return false;
    const dataBytes = new TextEncoder().encode(data);
    try {
      return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature as BufferSource, dataBytes as BufferSource);
    } catch {
      return false;
    }
  }

  private async signingKey(kid: string | undefined): Promise<CryptoKey | null> {
    await this.refreshKeys(false);
    const known = this.lookup(kid);
    if (known) return known;

    // Business: An unknown kid may simply be a key Supabase rotated in. Look once more — but no more often than
    // Business: the normal key window, or a caller could force a JWKS fetch with every request.
    if (kid && this.now() - this.forcedAt > KEY_CACHE_MS) {
      this.forcedAt = this.now();
      await this.refreshKeys(true);
      return this.lookup(kid);
    }
    return null;
  }

  private lookup(kid: string | undefined): CryptoKey | null {
    if (!this.keys) return null;
    if (kid) return this.keys.get(kid) ?? null;
    // No kid in the header (legacy single-key tokens): accept only if there is exactly one candidate key.
    return this.keys.size === 1 ? [...this.keys.values()][0] ?? null : null;
  }

  // Technical: Refresh is single-flight and failure-aware. A failed fetch NEVER overwrites the cached keys with
  // Technical: an empty set — the previous implementation did, which turned one transient Supabase error into
  // Technical: five minutes of 401s for every signed-in user. It only sets a short retry delay instead.
  private async refreshKeys(force: boolean): Promise<void> {
    if (this.inflight) return this.inflight;

    const now = this.now();
    if (!force) {
      if (this.keys && now - this.keysFetchedAt <= KEY_CACHE_MS) return;
      if (now < this.retryAt) return;
    }

    this.inflight = (async () => {
      try {
        const records = await fetchJwks(this.url, this.fetchImpl);
        const map = new Map<string, CryptoKey>();
        for (const record of records) {
          const key = await importSigningKey(record);
          if (key && record.kid) map.set(record.kid, key);
        }
        // An empty or unusable JWKS is a failure, not a valid "no keys exist" answer.
        if (map.size === 0) throw new Error('jwks contained no usable keys');
        this.keys = map;
        this.keysFetchedAt = this.now();
        this.retryAt = 0;
      } catch {
        this.retryAt = this.now() + KEY_RETRY_MS;
      } finally {
        this.inflight = null;
      }
    })();
    return this.inflight;
  }

  private principalFromClaims(claims: JwtClaims): Principal | null {
    const meta = (claims.app_metadata ?? {}) as Record<string, unknown>;
    const role = meta.role;
    if (!isStaffRole(role)) return null;
    // A technician acts AS their roster row; an admin's subject is their staff id (else the auth uid).
    if (role === 'technician') {
      const technicianId = meta.technicianId;
      if (typeof technicianId !== 'string' || !technicianId) return null;
      return { subject: technicianId, role };
    }
    const staffId = typeof meta.staffId === 'string' && meta.staffId ? meta.staffId : claims.sub;
    if (!staffId) return null;
    return { subject: staffId, role };
  }
}
