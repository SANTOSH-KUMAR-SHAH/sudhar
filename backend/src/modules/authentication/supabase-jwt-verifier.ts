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
    if (isExpired(decoded.payload, Math.floor(this.now() / 1000))) return null;

    const issuer = `${this.url.replace(/\/$/, '')}/auth/v1`;
    if (decoded.payload.iss !== issuer || decoded.payload.aud !== EXPECTED_AUDIENCE) return null;

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
    if (!this.keys || this.now() - this.keysFetchedAt > KEY_CACHE_MS) {
      const records = await fetchJwks(this.url, this.fetchImpl).catch(() => [] as JsonWebKeyRecord[]);
      const map = new Map<string, CryptoKey>();
      for (const record of records) {
        const key = await importSigningKey(record);
        if (key && record.kid) map.set(record.kid, key);
      }
      this.keys = map;
      this.keysFetchedAt = this.now();
    }
    if (kid) return this.keys.get(kid) ?? null;
    // No kid in the header (legacy single-key tokens): accept only if there is exactly one candidate key.
    return this.keys.size === 1 ? [...this.keys.values()][0] ?? null : null;
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
