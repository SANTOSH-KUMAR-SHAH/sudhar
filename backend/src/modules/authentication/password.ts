// Business: Staff secrets must never sit in the database as readable text. We store a salted SHA-256 and
// Business: check a sign-in by re-hashing what was typed — the raw password exists only in that moment.
// Business: The dev/in-memory accounts keep a plain secret, so `verifyCredential` recognises both shapes and
// Business: nothing about the existing tests or the local Worker changes; only Supabase rows are hashed.
// Technical: WebCrypto (crypto.subtle) is native to the Workers runtime AND to Node 18+ tests, so this needs
// no dependency and no polyfill. Stored format: `sha256$<saltHex>$<hashHex>` where hash = SHA-256("<salt>:<secret>").

const PREFIX = 'sha256$';

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return toHex(digest);
}

// Business: A fresh per-account salt so two staff sharing a password still store different hashes.
export function randomSalt(bytes = 16): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return [...buffer].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Business: The string we persist for a staff secret — salt and digest both travel inside it, so verifying
// Business: never needs a second lookup and old rows can be re-hashed when we later upgrade the algorithm.
export async function hashCredential(secret: string, salt: string = randomSalt()): Promise<string> {
  return `${PREFIX}${salt}$${await sha256Hex(`${salt}:${secret}`)}`;
}

// Business: Is this the right password? A stored hash is checked by re-hashing the guess with its salt;
// Business: a legacy/dev plain secret is compared directly, so in-memory seeding keeps working untouched.
export async function verifyCredential(stored: string, candidate: string): Promise<boolean> {
  if (!stored.startsWith(PREFIX)) return stored === candidate;
  const [, salt, hex] = stored.split('$');
  if (!salt || !hex) return false;
  return timingEqual(await sha256Hex(`${salt}:${candidate}`), hex);
}

// Business: Session tokens are opaque random strings; we store only their digest so a stolen database row
// Business: can never be replayed as someone's live login token.
export async function hashToken(token: string): Promise<string> {
  return sha256Hex(token);
}

// Technical: Length-independent constant-ish compare; avoids leaking how many leading hex chars matched.
function timingEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
