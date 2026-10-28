// Business: The Worker's front door. The application is assembled from whichever stores the environment
// Business: selects — Supabase when its bindings are present, the in-memory seeds only when DEMO_MODE was
// Business: explicitly requested. If neither is true we answer 503 and log the reason: an unconfigured deploy
// Business: must be visibly broken, never quietly serving a demo admin login.
// Technical: Default export is a module worker exposing { fetch }. The app is built ONCE and cached, because
// rebuilding per request would re-seed. We never touch process.env (absent in Workers) — bindings are the 2nd
// fetch argument, handed straight to buildStores.

import { Hono } from 'hono';
import { createApp } from './app';
import { PolicyRateLimiter } from './lib/rate-limit';
import {
  buildProvisioner,
  buildStores,
  ConfigurationError,
  demoModeEnabled,
  type SupabaseEnv,
} from './lib/stores';
import { LoggingRequestCodeNotifier } from './modules/notifications/request-code-notifier';

type BuiltApp = ReturnType<typeof createApp>;

let app: BuiltApp | null = null;

// Business: What a caller sees when the deployment is misconfigured. It says nothing about WHICH binding is
// Business: missing — that detail goes to the logs, not to a prober.
function unavailableApp(): Hono {
  const fallback = new Hono();
  fallback.all('*', (context) => context.json({ error: 'service_unavailable' }, 503));
  return fallback;
}

function resolveApp(env: SupabaseEnv): BuiltApp {
  if (app) return app;

  try {
    const users = buildProvisioner(env);
    app = createApp({
      ...buildStores(env),
      // Business: Only present under Supabase — it turns on the admin "add technician (with login)" endpoint.
      ...(users ? { users } : {}),
      notifier: new LoggingRequestCodeNotifier(),
      // Business: A deploy sets CORS_ORIGIN to the exact site(s) allowed to call. Only the local demo build
      // Business: mirrors any origin; a deployed Worker with no allow-list lets no browser origin through.
      corsOrigin: env.CORS_ORIGIN,
      allowAnyOrigin: demoModeEnabled(env),
      // Business: Every public budget is declared here, in one place, so a reader can see the whole abuse
      // Business: surface at a glance. The tightest one is per victim PHONE: a Track code guess is only
      // Business: useful next to that person's number, so five misses per quarter hour ends a sweep.
      rateLimiter: new PolicyRateLimiter({
        'intake-ip': { limit: 10, windowMs: 60_000 },
        'intake-phone': { limit: 3, windowMs: 60 * 60_000 },
        'track-ip': { limit: 30, windowMs: 5 * 60_000 },
        'track-phone': { limit: 5, windowMs: 15 * 60_000 },
        'auth-ip': { limit: 10, windowMs: 5 * 60_000 },
      }),
    });
  } catch (error) {
    if (!(error instanceof ConfigurationError)) throw error;
    console.error('[boot] refusing to serve:', error.message);
    app = unavailableApp();
  }
  return app;
}

export default {
  fetch(request: Request, env: SupabaseEnv, ctx: ExecutionContext): Response | Promise<Response> {
    return resolveApp(env).fetch(request, env, ctx);
  },
};
