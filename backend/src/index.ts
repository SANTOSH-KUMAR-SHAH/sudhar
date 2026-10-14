// Business: The Worker's front door. The application is assembled from whichever stores the environment
// Business: selects — Supabase when its bindings are present, otherwise the in-memory demo seeds — and that
// Business: choice changes nothing above it: routes, roles and the state machine are identical either way.
// Technical: Default export is a module worker exposing { fetch }. The app is built ONCE and cached, because
// rebuilding per request would re-seed. We never touch process.env (absent in Workers) — bindings are the 2nd
// fetch argument, handed straight to buildStores.

import { createApp } from './app';
import { FixedWindowRateLimiter } from './lib/rate-limit';
import { buildStores, type SupabaseEnv } from './lib/stores';
import { LoggingRequestCodeNotifier } from './modules/notifications/request-code-notifier';

type BuiltApp = ReturnType<typeof createApp>;

let app: BuiltApp | null = null;

function resolveApp(env: SupabaseEnv): BuiltApp {
  if (!app) {
    app = createApp({
      ...buildStores(env),
      notifier: new LoggingRequestCodeNotifier(),
      // Business: A deploy sets CORS_ORIGIN to the exact site(s) allowed to call; local dev leaves it unset
      // (which the app reads as "mirror any origin"), so no browser is blocked during development.
      corsOrigin: env.CORS_ORIGIN,
      rateLimiter: new FixedWindowRateLimiter({ limit: 60, windowMs: 60_000 }),
    });
  }
  return app;
}

export default {
  fetch(request: Request, env: SupabaseEnv, ctx: ExecutionContext): Response | Promise<Response> {
    return resolveApp(env).fetch(request, env, ctx);
  },
};
