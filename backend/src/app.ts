// Business: one place that assembles the API from its parts, so tests and the live Worker build the
// Business: exact same application and can never drift apart.
// Technical: a factory, not a singleton — the caller injects the repository. That is what lets a test
// hand in a seeded in-memory store while production (later) hands in Supabase.

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { ZodError } from 'zod';
import { SERVICE_STATUSES, isValidTransition } from '../../packages/shared/src/service-status';
import { IllegalTransitionError, NotFoundError } from './domain/errors';
import { nowNepalIso } from './lib/clock';
import { requestRoutes, technicianJobRoutes } from './modules/service-requests/request.routes';
import { trackRoutes } from './modules/service-requests/track.routes';
import { RequestService } from './modules/service-requests/request.service';
import type { RequestRepository } from './modules/service-requests/request.repository';
import type { CustomerRepository } from './modules/customers/customer.repository';
import type { RequestCodeNotifier } from './modules/notifications/request-code-notifier';

// Business/Technical: The app is built from injected ports, never from concrete stores. Production hands
// in the in-memory implementations; tests hand in fakes; Supabase later swaps the same slots.
export interface AppDependencies {
  requests: RequestRepository;
  customers: CustomerRepository;
  notifier: RequestCodeNotifier;
  clock?: () => string;
  // Business/Technical: Optional explicit allow-list of browser origins; empty means mirror-any (local dev).
  corsOrigin?: string;
}

export function createApp(deps: AppDependencies): Hono {
  const app = new Hono();
  const service = new RequestService({ ...deps, clock: deps.clock ?? nowNepalIso });

  // Business: The customer site runs on a different origin than this API, so the browser will block
  // Business: the submit call unless we say it is allowed. For local dev we mirror whatever origin asks.
  // Technical: CORS runs before routing so preflight OPTIONS never hits a handler. At deploy the caller
  // passes an explicit corsOrigin allow-list; no process.env here because the Workers runtime has none.
  const allowedOrigin = (deps.corsOrigin ?? '').split(',').filter(Boolean);
  app.use(
    '*',
    cors({
      origin: (origin) => (allowedOrigin.length > 0 ? (allowedOrigin.includes(origin) ? origin : null) : origin || '*'),
      allowHeaders: ['content-type'],
      allowMethods: ['GET', 'POST', 'OPTIONS'],
    }),
  );

  // The first shared round-trip: the live service answers with the canonical workflow length.
  app.get('/health', (context) =>
    context.json({
      service: 'sudhar-lab-api',
      status: 'ok',
      statuses: SERVICE_STATUSES.length,
      canConfirmNewRequest: isValidTransition('NEW_REQUEST', 'UNDER_REVIEW'),
    }));

  app.route('/api/requests', requestRoutes(service));
  app.route('/api/technicians', technicianJobRoutes(service));
  app.route('/api/track', trackRoutes(service));

  // Domain and contract failures become clean, stable JSON — never a stack trace to the caller.
  app.onError((error, context) => {
    if (error instanceof ZodError) {
      return context.json({ error: 'contract_violation', issues: error.issues }, 400);
    }
    if (error instanceof NotFoundError) {
      return context.json({ error: 'not_found' }, 404);
    }
    if (error instanceof IllegalTransitionError) {
      return context.json({ error: 'illegal_transition', from: error.from, to: error.to }, 409);
    }
    console.error(error);
    return context.json({ error: 'internal_error' }, 500);
  });

  return app;
}
