// Business: Every public budget must actually be separate and actually reset; and the limiter is exposed to the
// Business: internet, so its memory may not grow without bound as callers invent new keys.
// Technical: An injected clock makes windows deterministic — no timers, no sleeping.

import { describe, expect, it } from 'vitest';
import { PolicyRateLimiter } from './rate-limit';

const POLICIES = {
  'intake-ip': { limit: 2, windowMs: 1_000 },
  'intake-phone': { limit: 3, windowMs: 10_000 },
  'track-phone': { limit: 1, windowMs: 10_000 },
};

describe('PolicyRateLimiter', () => {
  it('keeps each policy and each key on its own budget', () => {
    let now = 0;
    const limiter = new PolicyRateLimiter(POLICIES, () => now);

    expect(limiter.allow('intake-ip:1.1.1.1')).toBe(true);
    expect(limiter.allow('intake-ip:1.1.1.1')).toBe(true);
    expect(limiter.allow('intake-ip:1.1.1.1')).toBe(false); // policy limit is 2
    // A different key, and a different policy, are unaffected.
    expect(limiter.allow('intake-ip:2.2.2.2')).toBe(true);
    expect(limiter.allow('intake-phone:C-9812345678')).toBe(true);
  });

  it('resets a key once its own window has elapsed', () => {
    let now = 0;
    const limiter = new PolicyRateLimiter(POLICIES, () => now);

    expect(limiter.allow('track-phone:C-1')).toBe(true);
    expect(limiter.allow('track-phone:C-1')).toBe(false);
    now = 10_000;
    expect(limiter.allow('track-phone:C-1')).toBe(true);
  });

  it('splits the key on the FIRST colon, so an IPv6 address is not mangled', () => {
    let now = 0;
    const limiter = new PolicyRateLimiter(POLICIES, () => now);

    expect(limiter.allow('intake-ip:2001:db8::1')).toBe(true);
    expect(limiter.allow('intake-ip:2001:db8::2')).toBe(true);
    expect(limiter.allow('intake-ip:2001:db8::1')).toBe(true); // second hit on the same address
    expect(limiter.allow('intake-ip:2001:db8::1')).toBe(false); // third exhausts the limit of 2
  });

  it('throws on an unknown policy instead of silently allowing traffic', () => {
    const limiter = new PolicyRateLimiter(POLICIES, () => 0);
    expect(() => limiter.allow('no-such-policy:key')).toThrow(/unknown rate-limit policy/);
  });

  it('fails closed at its bucket cap rather than growing forever — and recovers after the window', () => {
    let now = 0;
    const limiter = new PolicyRateLimiter({ 'intake-phone': { limit: 10, windowMs: 1_000 } }, () => now);

    // Fill the map with live buckets (one per invented phone). 50,000 is the documented cap.
    for (let i = 0; i < 50_000; i += 1) {
      expect(limiter.allow(`intake-phone:C-${i}`)).toBe(true);
    }
    // At capacity with nothing expired: a brand-new key is refused instead of being added.
    expect(limiter.allow('intake-phone:C-overflow')).toBe(false);

    // Once the windows end the buckets are reclaimed, and new callers are served again.
    now = 1_000;
    expect(limiter.allow('intake-phone:C-overflow')).toBe(true);
  });
});
