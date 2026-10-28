// Business: The public Track endpoint — the "where's my repair?" box on the customer site.
// Business: It is deliberately the least-trusting endpoint: both keys required, and it never reveals
// Business: whether a code exists, only "here is your job" or "not found".
// Business: A miss is also the only place a guess is cheap, so the VICTIM'S phone number carries its own tiny
// Business: budget: five misses per quarter hour ends any sweep, even for a caller who already knows the number.
// Technical: Query params are validated with safeParse (a bad query is a 400, distinct from a 404 miss),
// and the response is forced through the customer-safe trackedRequestSchema.

import { Hono } from 'hono';
import type { RateLimiter } from '../../lib/rate-limit';
import { customerIdForPhone } from '../customers/customer.repository';
import { trackQuerySchema, trackedRequestSchema } from './request.schema';
import type { RequestService } from './request.service';

export function trackRoutes(service: RequestService, limiter?: RateLimiter): Hono {
  const routes = new Hono();

  routes.get('/', async (context) => {
    const parsed = trackQuerySchema.safeParse({
      phone: context.req.query('phone'),
      code: context.req.query('code'),
    });
    if (!parsed.success) return context.json({ error: 'invalid_query' }, 400);

    const view = await service.track(parsed.data);
    if (!view) {
      // Business: Only FAILED attempts are metered. A customer checking their own job repeatedly is never
      // Business: locked out; a caller walking the code space hits the wall after five tries.
      // Security: the counter is keyed by the normalised phone identity, so re-spelling the same number
      // Security: (`+977 98…`) cannot buy a second budget.
      if (limiter && !limiter.allow(`track-phone:${customerIdForPhone(parsed.data.phone)}`)) {
        return context.json({ error: 'rate_limited' }, 429);
      }
      return context.json({ error: 'not_found' }, 404);
    }
    return context.json(trackedRequestSchema.parse(view));
  });

  return routes;
}
