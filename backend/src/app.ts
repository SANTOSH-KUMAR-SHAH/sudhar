// Business: one place that assembles the API from its parts, so tests and the live Worker build the
// Business: exact same application and can never drift apart.
// Technical: a factory, not a singleton — the caller injects the repository. That is what lets a test
// hand in a seeded in-memory store while production (later) hands in Supabase.

import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import { ZodError } from 'zod';
import { SERVICE_STATUSES, isValidTransition } from '../../packages/shared/src/service-status';
import { AuthorizationError, ConflictError, IllegalTransitionError, NotFoundError } from './domain/errors';
import { nowNepalIso } from './lib/clock';
import type { RateLimiter } from './lib/rate-limit';
import { authLoginRoutes } from './modules/authentication/login.routes';
import { AuthService } from './modules/authentication/login.service';
import type { AuthVerifier, TokenStore } from './modules/authentication/principal';
import { staffAdminRoutes } from './modules/authentication/staff-admin.routes';
import { StaffAdminService } from './modules/authentication/staff-admin.service';
import type { StaffRepository } from './modules/authentication/staff';
import { requestRoutes } from './modules/service-requests/request.routes';
import { adminRequestRoutes } from './modules/service-requests/admin.routes';
import { trackRoutes } from './modules/service-requests/track.routes';
import { RequestService } from './modules/service-requests/request.service';
import type { RequestRepository } from './modules/service-requests/request.repository';
import { CustomerService } from './modules/customers/customer.service';
import { customerRoutes } from './modules/customers/customer.routes';
import { TechnicianService } from './modules/technicians/technician.service';
import { technicianRoutes } from './modules/technicians/technician.routes';
import type { TechnicianRepository } from './modules/technicians/technician.repository';
import type { CustomerRepository } from './modules/customers/customer.repository';
import type { RequestCodeNotifier } from './modules/notifications/request-code-notifier';

// Business/Technical: The app is built from injected ports, never from concrete stores. Production hands
// in the in-memory implementations; tests hand in fakes; Supabase later swaps the same slots.
export interface AppDependencies {
  requests: RequestRepository;
  customers: CustomerRepository;
  technicians: TechnicianRepository;
  notifier: RequestCodeNotifier;
  // Business/Technical: identity is a required seam — the app cannot be assembled without a way to
  // verify a caller. Production injects SessionAuthVerifier; tests inject a static one; M7 injects JWT.
  auth: AuthVerifier;
  staff: StaffRepository;
  tokens: TokenStore;
  clock?: () => string;
  // Business/Technical: Optional explicit allow-list of browser origins; empty means mirror-any (local dev).
  corsOrigin?: string;
  // Business/Technical: Optional abuse control on the public endpoints; absent means unlimited (tests).
  rateLimiter?: RateLimiter;
}

export function createApp(deps: AppDependencies): Hono {
  const app = new Hono();
  const service = new RequestService({ ...deps, clock: deps.clock ?? nowNepalIso });
  const technicianService = new TechnicianService(deps.technicians, deps.requests);
  const customerService = new CustomerService(deps.customers);
  const authService = new AuthService(deps.staff, deps.tokens);
  const staffAdminService = new StaffAdminService(deps.staff, deps.technicians);

  // Business: The customer site runs on a different origin than this API, so the browser will block
  // Business: the submit call unless we say it is allowed. For local dev we mirror whatever origin asks.
  // Business: Staff portals call with a bearer token, so the browser preflights the `authorization`
  // Business: header — it must be explicitly allowed or every signed-in read is silently blocked.
  // Technical: CORS runs before routing so preflight OPTIONS never hits a handler. At deploy the caller
  // passes an explicit corsOrigin allow-list; no process.env here because the Workers runtime has none.
  const allowedOrigin = (deps.corsOrigin ?? '').split(',').filter(Boolean);
  app.use(
    '*',
    cors({
      origin: (origin) => (allowedOrigin.length > 0 ? (allowedOrigin.includes(origin) ? origin : null) : origin || '*'),
      allowHeaders: ['content-type', 'authorization'],
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

  // Business: the two customer-facing endpoints are open to the public, so a caller can't spam them.
  // Technical: keyed per client IP when the platform supplies one, else one shared local bucket. Absent
  // limiter = no throttling (unit tests); the live Worker always injects one.
  if (deps.rateLimiter) {
    const limiter = deps.rateLimiter;
    const throttle = async (context: Context, next: () => Promise<void>): Promise<Response | void> => {
      const key =
        context.req.header('cf-connecting-ip') ?? context.req.header('x-forwarded-for') ?? 'local';
      if (!limiter.allow(`${key}:${context.req.path}`)) {
        return context.json({ error: 'rate_limited' }, 429);
      }
      await next();
    };
    app.use('/api/requests', throttle);
    app.use('/api/track', throttle);
  }

  app.route('/api/auth', authLoginRoutes(authService));
  app.route('/api/requests', requestRoutes(service, deps.auth));
  app.route('/api/technicians', technicianRoutes(technicianService, service, deps.auth));
  app.route('/api/track', trackRoutes(service));
  app.route('/api/customers', customerRoutes(customerService, deps.auth));
  app.route('/api/admin/requests', adminRequestRoutes(service, deps.auth));
  app.route('/api/admin/staff', staffAdminRoutes(staffAdminService, deps.auth));

  // Domain and contract failures become clean, stable JSON — never a stack trace to the caller.
  app.onError((error, context) => {
    if (error instanceof ZodError) {
      return context.json({ error: 'contract_violation', issues: error.issues }, 400);
    }
    if (error instanceof NotFoundError) {
      return context.json({ error: 'not_found' }, 404);
    }
    if (error instanceof AuthorizationError) {
      return context.json({ error: error.kind }, error.kind === 'unauthenticated' ? 401 : 403);
    }
    if (error instanceof ConflictError) {
      return context.json({ error: 'conflict' }, 409);
    }
    if (error instanceof IllegalTransitionError) {
      return context.json({ error: 'illegal_transition', from: error.from, to: error.to }, 409);
    }
    console.error(error);
    return context.json({ error: 'internal_error' }, 500);
  });

  return app;
}
