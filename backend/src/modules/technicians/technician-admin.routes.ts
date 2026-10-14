// Business: The admin-only door to adding a technician. It exposes exactly one verb — create — because granting
// Business: portal access is the admin's job, never something the public or a technician can do to themselves.
// Technical: Mounted at /api/admin/technicians in app.ts, and only when a login provisioner is wired (Supabase).
// Business: The response is the created roster card; the schema omits the password, so a credential can't leak.
import { Hono } from 'hono';
import { authenticate } from '../authentication/guard';
import type { AuthVerifier } from '../authentication/principal';
import { createTechnicianSchema, createdTechnicianSchema } from './technician-admin.schema';
import type { TechnicianAdminService } from './technician-admin.service';

export function technicianAdminRoutes(service: TechnicianAdminService, auth: AuthVerifier): Hono {
  const routes = new Hono();

  routes.post('/', async (context) => {
    await authenticate(auth, context.req.header('authorization'), ['admin']);
    const input = createTechnicianSchema.parse(await context.req.json());
    const created = await service.create(input);
    return context.json(createdTechnicianSchema.parse(created), 201);
  });

  return routes;
}
