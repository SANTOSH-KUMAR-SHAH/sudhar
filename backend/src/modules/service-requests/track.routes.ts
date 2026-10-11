// Business: The public Track endpoint — the "where's my repair?" box on the customer site.
// Business: It is deliberately the least-trusting endpoint: both keys required, and it never reveals
// Business: whether a code exists, only "here is your job" or "not found".
// Technical: Query params are validated with safeParse (a bad query is a 400, distinct from a 404 miss),
// and the response is forced through the customer-safe trackedRequestSchema.

import { Hono } from 'hono';
import { trackQuerySchema, trackedRequestSchema } from './request.schema';
import type { RequestService } from './request.service';

export function trackRoutes(service: RequestService): Hono {
  const routes = new Hono();

  routes.get('/', async (context) => {
    const parsed = trackQuerySchema.safeParse({
      phone: context.req.query('phone'),
      code: context.req.query('code'),
    });
    if (!parsed.success) return context.json({ error: 'invalid_query' }, 400);

    const view = await service.track(parsed.data);
    if (!view) return context.json({ error: 'not_found' }, 404);
    return context.json(trackedRequestSchema.parse(view));
  });

  return routes;
}
