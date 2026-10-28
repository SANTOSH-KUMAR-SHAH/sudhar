// Business: The public request code must not be guessable from the previous one. A customer's phone plus
// Business: a sequential number made a job readable by anyone who knew the number and could count — so the
// Business: digits are now drawn from the platform's CSPRNG instead of a counter.
// Technical: Uniform decimal digits via rejection sampling on single bytes (accept < 250, take % 10, reject
// Technical: the top 6 values). Avoids both Math.random and the modulo bias a naive `byte % 10` would give.

const ACCEPT_BELOW = 250; // 250 = 25 * 10, so every accepted byte maps to a digit with equal probability

export function randomDigits(length: number): string {
  const buffer = new Uint8Array(length * 2);
  let digits = '';
  while (digits.length < length) {
    crypto.getRandomValues(buffer);
    for (const byte of buffer) {
      if (byte >= ACCEPT_BELOW) continue;
      digits += String(byte % 10);
      if (digits.length === length) break;
    }
  }
  return digits;
}
