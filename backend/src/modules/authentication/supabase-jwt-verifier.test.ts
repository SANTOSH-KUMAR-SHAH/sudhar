// Business: A Supabase access token is the ONLY thing that says who is calling. This proves the Worker trusts it
// Business: exactly as far as it should: a token genuinely signed by the project's key, with the right issuer /
// Business: audience and a live expiry, becomes a Principal; anything forged, expired, mis-audience'd or signed by
// Business: a different key becomes null (a clean 401) — never a half-trusted identity.
// Technical: We mint a throwaway RSA keypair, publish its public half as the project JWKS, and hand-sign tokens —
// no live Supabase needed. fetchImpl + clock are injected so the test is fully offline and deterministic.

import { describe, expect, it, beforeAll } from 'vitest';
import { SupabaseJwtVerifier } from './supabase-jwt-verifier';
import type { JsonWebKeyRecord } from '../../lib/supabase-auth';

const URL = 'https://test-project.supabase.co';
const ISSUER = `${URL}/auth/v1`;
const KID = 'test-key-1';

const encoder = new TextEncoder();

function bytesToB64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function jsonToB64url(value: unknown): string {
  return bytesToB64url(encoder.encode(JSON.stringify(value)));
}

async function generateRsaKey(): Promise<CryptoKeyPair> {
  return (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
}

async function signToken(privateKey: CryptoKey, header: Record<string, unknown>, claims: Record<string, unknown>): Promise<string> {
  const data = `${jsonToB64url({ ...header, alg: 'RS256' })}.${jsonToB64url(claims)}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, encoder.encode(data));
  return `${data}.${bytesToB64url(new Uint8Array(signature))}`;
}

function jwksFetch(keys: JsonWebKeyRecord[]): typeof globalThis.fetch {
  return (async () =>
    new Response(JSON.stringify({ keys }), { status: 200, headers: { 'content-type': 'application/json' } })) as unknown as typeof globalThis.fetch;
}

let keyPair: CryptoKeyPair;
let foreignKeyPair: CryptoKeyPair;
let publicJwk: JsonWebKey;

beforeAll(async () => {
  keyPair = await generateRsaKey();
  foreignKeyPair = await generateRsaKey();
  publicJwk = (await crypto.subtle.exportKey('jwk', keyPair.publicKey)) as JsonWebKey;
});

function verifierFor(keys: JsonWebKeyRecord[], nowSeconds = Math.floor(Date.now() / 1000)): SupabaseJwtVerifier {
  return new SupabaseJwtVerifier(URL, { fetchImpl: jwksFetch(keys), now: () => nowSeconds * 1000 });
}

// Built lazily because beforeAll populates publicJwk; at module load the key is not yet exported.
function projectKey(): JsonWebKeyRecord {
  return { kid: KID, kty: 'RSA', n: publicJwk.n, e: publicJwk.e, alg: 'RS256', use: 'sig' };
}

describe('SupabaseJwtVerifier — a well-formed token', () => {
  it('maps a technician app_metadata to a Principal keyed by their technician id', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signToken(keyPair.privateKey, { kid: KID }, {
      iss: ISSUER, sub: 'auth-uuid', aud: 'authenticated', exp: now + 3600, iat: now,
      app_metadata: { role: 'technician', technicianId: 'T-2003' },
    });
    const principal = await verifierFor([projectKey()], now).verify(token);
    expect(principal).toEqual({ subject: 'T-2003', role: 'technician' });
  });

  it('maps an admin app_metadata to a Principal keyed by their staff id', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signToken(keyPair.privateKey, { kid: KID }, {
      iss: ISSUER, sub: 'auth-uuid', aud: 'authenticated', exp: now + 3600, iat: now,
      app_metadata: { role: 'admin', staffId: 'A-1' },
    });
    const principal = await verifierFor([projectKey()], now).verify(token);
    expect(principal).toEqual({ subject: 'A-1', role: 'admin' });
  });
});

describe('SupabaseJwtVerifier — refuses anything it cannot fully trust', () => {
  const baseClaims = (now: number) => ({
    iss: ISSUER, sub: 'auth-uuid', aud: 'authenticated', exp: now + 3600, iat: now,
    app_metadata: { role: 'technician', technicianId: 'T-2003' },
  });

  it('rejects an expired token', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signToken(keyPair.privateKey, { kid: KID }, { ...baseClaims(now), exp: now - 10 });
    expect(await verifierFor([projectKey()], now).verify(token)).toBeNull();
  });

  it('rejects the wrong audience', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signToken(keyPair.privateKey, { kid: KID }, { ...baseClaims(now), aud: 'anon' });
    expect(await verifierFor([projectKey()], now).verify(token)).toBeNull();
  });

  it('rejects the wrong issuer', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signToken(keyPair.privateKey, { kid: KID }, { ...baseClaims(now), iss: 'https://evil.example/auth/v1' });
    expect(await verifierFor([projectKey()], now).verify(token)).toBeNull();
  });

  it('rejects a token signed by a foreign key', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signToken(foreignKeyPair.privateKey, { kid: KID }, baseClaims(now));
    expect(await verifierFor([projectKey()], now).verify(token)).toBeNull();
  });

  it('rejects a token whose kid is not in the JWKS', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signToken(keyPair.privateKey, { kid: 'unknown-kid' }, baseClaims(now));
    expect(await verifierFor([projectKey()], now).verify(token)).toBeNull();
  });

  it('rejects a non-RS256 algorithm', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signToken(keyPair.privateKey, { kid: KID, alg: 'HS256' }, baseClaims(now));
    // signToken forces alg RS256 into the header spread, so build a header-alg override explicitly:
    const data = `${jsonToB64url({ alg: 'none', kid: KID })}.${jsonToB64url(baseClaims(now))}`;
    const unsigned = `${data}.`;
    expect(await verifierFor([projectKey()], now).verify(unsigned)).toBeNull();
    expect(token).toBeTruthy(); // signed token itself stays valid — sanity that the fixture works
  });

  it('returns null for a malformed or empty token without throwing', async () => {
    const verifier = verifierFor([projectKey()]);
    expect(await verifier.verify(undefined)).toBeNull();
    expect(await verifier.verify('not.a.jwt')).toBeNull();
  });

  it('rejects a valid signature that claims a role we do not staff', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signToken(keyPair.privateKey, { kid: KID }, {
      iss: ISSUER, sub: 'auth-uuid', aud: 'authenticated', exp: now + 3600, iat: now,
      app_metadata: { role: 'customer' },
    });
    expect(await verifierFor([projectKey()], now).verify(token)).toBeNull();
  });
});

describe('SupabaseJwtVerifier — honours only short-lived access tokens (refresh replay fixed)', () => {
  it('rejects a long-lived token (a refresh token replayed as a bearer credential)', async () => {
    const now = Math.floor(Date.now() / 1000);
    // Perfectly signed, right iss/aud, NOT expired — but valid for 30 days, which only a refresh token is.
    const token = await signToken(keyPair.privateKey, { kid: KID }, {
      iss: ISSUER, sub: 'auth-uuid', aud: 'authenticated', iat: now, exp: now + 30 * 86_400,
      app_metadata: { role: 'admin', staffId: 'A-1' },
    });
    expect(await verifierFor([projectKey()], now).verify(token)).toBeNull();
  });

  it('rejects a short-lived token that self-declares a refresh type', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signToken(keyPair.privateKey, { kid: KID }, {
      iss: ISSUER, sub: 'auth-uuid', aud: 'authenticated', iat: now, exp: now + 3600, type: 'refresh_token',
      app_metadata: { role: 'admin', staffId: 'A-1' },
    });
    expect(await verifierFor([projectKey()], now).verify(token)).toBeNull();
  });

  it('still accepts a normal access token that carries type: "access"', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signToken(keyPair.privateKey, { kid: KID }, {
      iss: ISSUER, sub: 'auth-uuid', aud: 'authenticated', iat: now, exp: now + 3600, type: 'access',
      app_metadata: { role: 'technician', technicianId: 'T-2003' },
    });
    expect(await verifierFor([projectKey()], now).verify(token)).toEqual({ subject: 'T-2003', role: 'technician' });
  });
});

describe('SupabaseJwtVerifier — key refresh survives a Supabase outage', () => {
  it('rejects a token with no stated expiry rather than treating it as eternal', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signToken(keyPair.privateKey, { kid: KID }, {
      iss: ISSUER, sub: 'auth-uuid', aud: 'authenticated', iat: now,
      app_metadata: { role: 'admin', staffId: 'A-1' },
    });
    expect(await verifierFor([projectKey()], now).verify(token)).toBeNull();
  });

  it('keeps verifying with the last known-good keys when a later JWKS fetch fails', async () => {
    const base = Math.floor(Date.now() / 1000);
    let nowSeconds = base;
    let fetches = 0;
    const flakyFetch = (async () => {
      fetches += 1;
      if (fetches === 1) {
        return new Response(JSON.stringify({ keys: [projectKey()] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      throw new Error('supabase unreachable');
    }) as unknown as typeof globalThis.fetch;

    const verifier = new SupabaseJwtVerifier(URL, { fetchImpl: flakyFetch, now: () => nowSeconds * 1000 });
    const token = await signToken(keyPair.privateKey, { kid: KID }, {
      iss: ISSUER, sub: 'auth-uuid', aud: 'authenticated', iat: base, exp: base + 7200,
      app_metadata: { role: 'admin', staffId: 'A-1' },
    });

    expect(await verifier.verify(token)).not.toBeNull();

    // Past the 5-minute key cache the verifier tries again; the attempt fails, but the cached key must stand.
    nowSeconds = base + 6 * 60;
    expect(await verifier.verify(token)).not.toBeNull();
    expect(fetches).toBe(2);

    // …and the failure is not re-attempted on every subsequent request (30s backoff).
    expect(await verifier.verify(token)).not.toBeNull();
    expect(fetches).toBe(2);
  });
});
