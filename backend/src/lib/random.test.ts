// Business: The customer's request code has to be unguessable from the previous one, so the generator must be
// Business: uniform, unpredictable and never accidentally short.
// Technical: Property-style checks over many draws; a CSPRNG makes the distribution assertions stable enough
// Technical: (the chance of a false failure here is astronomically small).

import { describe, expect, it } from 'vitest';
import { randomDigits } from './random';

describe('randomDigits', () => {
  it('returns exactly the requested number of decimal digits', () => {
    for (const length of [1, 6, 12]) {
      const value = randomDigits(length);
      expect(value).toHaveLength(length);
      expect(value).toMatch(/^\d+$/);
    }
  });

  it('does not hand back a repeated sequence — a sweep-able counter would defeat the whole point', () => {
    const draws = new Set(Array.from({ length: 50 }, () => randomDigits(6)));
    // 900,000 possible values; 50 draws collapsing to one value would mean the source is broken.
    expect(draws.size).toBeGreaterThan(1);
  });

  it('spreads across the digit space instead of favouring a range', () => {
    // A naive `byte % 10` over the full 0-255 range biases the first six digits. Over 2,000 digits each
    // bucket should still land in a sane band; this is a smoke test, not a statistical proof.
    const counts = new Array<number>(10).fill(0);
    for (let i = 0; i < 200; i += 1) {
      for (const char of randomDigits(10)) counts[Number(char)]! += 1;
    }
    // 2,000 digits over 10 buckets = 200 expected each; even heavy sampling noise stays well inside 100-300.
    for (const count of counts) {
      expect(count).toBeGreaterThan(100);
      expect(count).toBeLessThan(300);
    }
  });
});
