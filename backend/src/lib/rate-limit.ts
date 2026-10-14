// Business: stop one caller from hammering the public endpoints (spamming submissions, brute-forcing
// Business: Track codes). Over the limit within a window → a clean 429, nothing runs.
// Technical: a fixed window per key. In-memory and single-node today; at scale the same RateLimiter
// port maps to Workers KV / Durable Objects. No process.env, no timers — lazily reset per key on read.

export interface RateLimiter {
  allow(key: string): boolean;
}

export interface RateLimitOptions {
  limit: number; // max hits per window
  windowMs: number;
  now?: () => number; // injectable clock so tests can fast-forward
}

export class FixedWindowRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly now: () => number;

  constructor(options: RateLimitOptions) {
    this.limit = options.limit;
    this.windowMs = options.windowMs;
    this.now = options.now ?? (() => Date.now());
  }

  allow(key: string): boolean {
    const time = this.now();
    const bucket = this.buckets.get(key);

    if (!bucket || time >= bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: time + this.windowMs });
      return true;
    }
    if (bucket.count >= this.limit) return false;

    bucket.count += 1;
    return true;
  }
}
