// Business: A tiny, self-contained JWT toolkit so the Worker can verify a Supabase-issued access token on
// Business: its own — no npm dependency, nothing to polyfill, and every failure returns a clean null (which the
// Business: guard turns into a 401) instead of throwing a stack trace at a caller.
// Technical: Signature-only module by design: crypto.subtle.verify RSASSA-PKCS1-v1_5 / SHA-256 (RS256) needs a
// real ArrayBuffer, so we decode the base64url segments to BYTES, not strings — a naive atob().split('') corrupts
// any non-ASCII claim byte and makes a genuine token look forged. Header/claims are decoded as UTF-8 text.

export interface JwtHeader {
  alg: string;
  kid?: string;
  typ?: string;
}

// A decoded Supabase access token. `app_metadata` is where WE put { role, technicianId? } at signup; it is
// carried inside the signed token, so the Worker can trust it without a second database read.
export interface JwtClaims {
  iss?: string;
  sub?: string;
  aud?: string;
  exp?: number;
  iat?: number;
  role?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

export interface DecodedJwt {
  header: JwtHeader;
  payload: JwtClaims;
  data: string; // the exact "header.payload" string that was signed
  signature: Uint8Array;
}

function base64UrlDecodeSegment(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// Business: The signature bytes must be the raw base64url-decoded value — decode-to-bytes, never via a string.
function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function decodeJwt(token: string): DecodedJwt | null {
  const segments = token.split('.');
  if (segments.length !== 3) return null;
  const [encodedHeader, encodedPayload, encodedSignature] = segments;
  try {
    const header = JSON.parse(base64UrlDecodeSegment(encodedHeader)) as JwtHeader;
    const payload = JSON.parse(base64UrlDecodeSegment(encodedPayload)) as JwtClaims;
    const signature = base64UrlToBytes(encodedSignature);
    return { header, payload, data: `${encodedHeader}.${encodedPayload}`, signature };
  } catch {
    return null;
  }
}

// Business: A token is only honoured if it is not past its stated expiry. The clock is injectable for tests.
export function isExpired(claims: JwtClaims, nowSeconds: number): boolean {
  return typeof claims.exp === 'number' && claims.exp <= nowSeconds;
}
