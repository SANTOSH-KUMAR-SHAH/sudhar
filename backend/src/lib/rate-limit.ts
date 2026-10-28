// Business: stop one caller from hammering the public endpoints (spamming submissions, brute-forcing
// Business: Track codes). Over the limit within a window → a clean 429, nothing runs.
// Technical: a fixed window per key. In-memory and single-node today; at scale the same RateLimiter
// port maps to Workers KV / Durable Objects. No process.env, no timers — lazily reset per key on read.

export interface RateLimiter {
  allow(key: string): boolean;
}

export interface RateLimitPolicy {
  limit: number; // max hits per window
  windowMs: number;
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

// Business: one injected limiter has to enforce DIFFERENT budgets for different kinds of traffic — a
// Business: submission, a Track guess and a sign-in are not equally cheap, and a victim's phone number
// Business: needs a much tighter budget than the whole internet does. The policy name rides in front of
// Business: the key (`intake-phone:98…`) so a single instance can hold every budget without the app
// Business: knowing which one applies.
// Technical: `prefix:suffix` — the prefix selects a policy, everything after the first colon is the key
// Technical: (so an IPv6 address keeps its own colons intact). An unknown policy throws immediately: it is
// Technical: a wiring bug, and silently allowing it would mean shipping with no throttle at all.
// Security: keys are caller-influenced (a phone number, an IP), and every new key used to allocate a bucket that
// Security: was never freed — a slow memory leak an attacker controls. Expired buckets are now swept as the map
// Security: grows, and if the hard cap is still reached the request is DENIED: failing closed is the only safe
// Security: answer, because evicting a live bucket would silently restore someone's spent budget.
const SWEEP_EVERY = 256;
const MAX_BUCKETS = 50_000;

export class PolicyRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();
  private readonly now: () => number;
  private calls = 0;

  constructor(
    private readonly policies: Record<string, RateLimitPolicy>,
    now: () => number = () => Date.now(),
  ) {
    this.now = now;
  }

  allow(key: string): boolean {
    const separator = key.indexOf(':');
    const policyName = separator === -1 ? key : key.slice(0, separator);
    const policy = this.policies[policyName];
    if (!policy) throw new Error(`unknown rate-limit policy: ${policyName}`);

    const time = this.now();
    this.calls += 1;
    if (this.calls % SWEEP_EVERY === 0) this.sweep(time);

    const bucket = this.buckets.get(key);
    if (!bucket) {
      // Security: at capacity, only an EXPIRED bucket may be reclaimed; if none is, refuse rather than grow
      // Security: without bound or evict a live budget.
      if (this.buckets.size >= MAX_BUCKETS) {
        this.sweep(time);
        if (this.buckets.size >= MAX_BUCKETS) return false;
      }
      this.buckets.set(key, { count: 1, resetAt: time + policy.windowMs });
      return true;
    }
    if (time >= bucket.resetAt) {
      bucket.count = 1;
      bucket.resetAt = time + policy.windowMs;
      return true;
    }
    if (bucket.count >= policy.limit) return false;
    bucket.count += 1;
    return true;
  }

  // Technical: Drops only buckets whose window has already ended — their state carries no information any more.
  private sweep(time: number): void {
    for (const [key, bucket] of this.buckets) {
      if (time >= bucket.resetAt) this.buckets.delete(key);
    }
  }
}
