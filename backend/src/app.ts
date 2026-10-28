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
import { PayloadTooLargeError } from './lib/http';
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
import { TechnicianAdminService } from './modules/technicians/technician-admin.service';
import { technicianAdminRoutes } from './modules/technicians/technician-admin.routes';
import type { TechnicianRepository } from './modules/technicians/technician.repository';
import type { CustomerRepository } from './modules/customers/customer.repository';
import type { RequestCodeNotifier } from './modules/notifications/request-code-notifier';
import type { AuthUserProvisioner } from './lib/supabase-auth';

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
  // Business: Optional, present only when Supabase Auth is wired. It is what makes the admin "add a technician
  // Business: with a real login" endpoint possible; without it that route is simply not mounted.
  users?: AuthUserProvisioner;
  clock?: () => string;
  // Business/Technical: Optional explicit allow-list of browser origins. Empty means NO browser origin is
  // Business: allowed — a deploy that forgot the list is broken loudly rather than open to every site.
  corsOrigin?: string;
  // Business: Only the local demo build may mirror whatever origin calls it. Set from DEMO_MODE in index.ts.
  allowAnyOrigin?: boolean;
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
  // Business: the submit call unless we say it is allowed. Staff portals call with a bearer token, so the
  // Business: browser preflights the `authorization` header — it must be explicitly allowed or every
  // Business: signed-in read is silently blocked.
  // Technical: CORS runs before routing so preflight OPTIONS never hits a handler. At deploy the caller
  // passes an explicit corsOrigin allow-list; no process.env here because the Workers runtime has none.
  const allowedOrigin = (deps.corsOrigin ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowAnyOrigin = deps.allowAnyOrigin === true;
  app.use(
    '*',
    cors({
      origin: (origin) => {
        // Security: an unset allow-list USED to mean "mirror any origin", which is correct only for the local
        // Security: demo. Now that decision is explicit: any-origin in demo mode, otherwise an exact match or no
        // Security: CORS header at all. A non-browser caller (no Origin header) is unaffected either way.
        if (!origin) return '';
        if (allowAnyOrigin) return origin;
        return allowedOrigin.includes(origin) ? origin : null;
      },
      allowHeaders: ['content-type', 'authorization'],
      allowMethods: ['GET', 'POST', 'OPTIONS'],
    }),
  );

  // Business: Every JSON body we accept is small by nature, so an oversized one is refused before it is
  // Business: read or parsed — one anonymous request cannot burn memory/CPU or bloat a row at our expense.
  // Technical: This is the cheap declared-length gate; readJsonBody enforces the real byte count on intake.
  const MAX_REQUEST_BYTES = 64 * 1024;
  app.use('*', async (context, next) => {
    const declared = Number(context.req.header('content-length') ?? '');
    if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) {
      return context.json({ error: 'payload_too_large' }, 413);
    }
    await next();
  });

  // The first shared round-trip: the live service answers with the canonical workflow length.
  app.get('/health', (context) =>
    context.json({
      service: 'sudhar-lab-api',
      status: 'ok',
      statuses: SERVICE_STATUSES.length,
      canConfirmNewRequest: isValidTransition('NEW_REQUEST', 'UNDER_REVIEW'),
    }));

  // Business: the customer-facing endpoints are open to the public, so a caller can't spam them.
  // Technical: keyed per client IP when the platform supplies one, else one shared local bucket. Each route
  // registers a NAMED policy (see PolicyRateLimiter) so unlike traffic gets unlike budgets. The per-phone
  // budget lives inside the handlers — only there is the phone known. Absent limiter = no throttling (tests);
  // the live Worker always injects one.
  if (deps.rateLimiter) {
    const limiter = deps.rateLimiter;
    const clientKey = (context: Context): string =>
      context.req.header('cf-connecting-ip') ?? context.req.header('x-forwarded-for') ?? 'local';

    app.use('/api/requests', async (context, next) => {
      // Only the public POST is metered; an admin advancing a job is authenticated and unlimited here.
      if (context.req.method !== 'POST' || context.req.path !== '/api/requests') {
        await next();
        return;
      }
      if (!limiter.allow(`intake-ip:${clientKey(context)}`)) {
        return context.json({ error: 'rate_limited' }, 429);
      }
      await next();
    });

    app.use('/api/track', async (context, next) => {
      if (context.req.method !== 'GET') {
        await next();
        return;
      }
      if (!limiter.allow(`track-ip:${clientKey(context)}`)) {
        return context.json({ error: 'rate_limited' }, 429);
      }
      await next();
    });

    // Business: the legacy credential oracle exists only in the demo build; even there, guessing gets a budget.
    // Technical: the wildcard is required — Hono matches `use('/api/auth')` EXACTLY, so it would never cover
    // Technical: `/api/auth/login` and the throttle would silently not exist.
    app.use('/api/auth/*', async (context, next) => {
      if (!limiter.allow(`auth-ip:${clientKey(context)}`)) {
        return context.json({ error: 'rate_limited' }, 429);
      }
      await next();
    });
  }

  // Business: The legacy opaque-login endpoint (identifier+secret -> session token) exists only for the
  // Business: in-memory build. Once Supabase Auth is wired (deps.users present), sign-in happens browser-side
  // Business: against GoTrue, so this route is NOT mounted — left on it would be an unthrottled password
  // Business: oracle that answers 200/401 and lets an attacker enumerate staff credentials offline.
  if (!deps.users) {
    app.route('/api/auth', authLoginRoutes(authService));
  }
  app.route('/api/requests', requestRoutes(service, deps.auth, deps.rateLimiter));
  app.route('/api/technicians', technicianRoutes(technicianService, service, deps.auth));
  app.route('/api/track', trackRoutes(service, deps.rateLimiter));
  app.route('/api/customers', customerRoutes(customerService, deps.auth));
  app.route('/api/admin/requests', adminRequestRoutes(service, deps.auth));
  // Business: The legacy in-app staff surface is superseded by /api/admin/technicians (which mints a real
  // Business: Supabase login). Under Supabase it must not be reachable, so it is mounted only for the offline build.
  if (!deps.users) {
    app.route('/api/admin/staff', staffAdminRoutes(staffAdminService, deps.auth));
  }
  // Business: Only offer "create technician (with login)" when a real Supabase provisioner exists — so the
  // Business: offline/demo build never advertises a capability it cannot honour.
  if (deps.users) {
    app.route('/api/admin/technicians', technicianAdminRoutes(new TechnicianAdminService(deps.technicians, deps.users), deps.auth));
  }

  // Business: unmatched routes (including the removed public job reads) answer one stable, detail-free 404.
  // Technical: no path or input is echoed back — a probe learns only "nothing here", never what we expect.
  app.notFound((context) => context.json({ error: 'not_found' }, 404));

  // Domain and contract failures become clean, stable JSON — never a stack trace to the caller.
  app.onError((error, context) => {
    if (error instanceof ZodError) {
      // Business: A contract breach is a 400, but the field-level detail (which rule failed on what value) is
      // Business: a free map of our validation for anyone probing it. Return a stable code; log the paths only.
      console.warn('contract_violation', error.issues.map((issue) => issue.path.join('.')));
      return context.json({ error: 'contract_violation' }, 400);
    }
    // Business: An oversized body is refused with its own stable code, so the client can tell "too big" from
    // Business: "malformed" — and neither answer echoes the input back.
    if (error instanceof PayloadTooLargeError) {
      return context.json({ error: 'payload_too_large' }, 413);
    }
    // Business: Body that is not valid JSON used to fall through to a 500 (a stack trace in the logs and a
    // Business: misleading "we are broken" to the caller). It is the caller's mistake: 400, nothing parsed.
    if (error instanceof SyntaxError) {
      return context.json({ error: 'invalid_json' }, 400);
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
