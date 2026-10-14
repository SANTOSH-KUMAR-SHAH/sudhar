// Business: the sign-in door. Right credentials → a session token; anything else → one uniform 401.
// Technical: the only unauthenticated write that exists; every other write sits behind authenticate().
import { Hono } from 'hono';
import { loginResultSchema, loginSchema } from './login.schema';
import type { AuthService } from './login.service';

export function authLoginRoutes(auth: AuthService): Hono {
  const routes = new Hono();

  routes.post('/login', async (context) => {
    const { identifier, secret } = loginSchema.parse(await context.req.json());
    const session = await auth.login(identifier, secret);
    if (!session) return context.json({ error: 'invalid_credentials' }, 401);
    return context.json(loginResultSchema.parse(session));
  });

  return routes;
}
