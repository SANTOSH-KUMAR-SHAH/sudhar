// Business: who may sign in — the admin lists them and creates new logins. Customers never appear.
// Technical: admin-role-gated; the provision response is a StaffSummary (no secret), so the credential
// is write-only from the API's point of view.
import { Hono } from 'hono';
import { readJsonBody } from '../../lib/http';
import { authenticate } from './guard';
import type { AuthVerifier } from './principal';
import { staffProvisionSchema, staffSummarySchema } from './staff-admin.schema';
import type { StaffAdminService } from './staff-admin.service';

export function staffAdminRoutes(staff: StaffAdminService, auth: AuthVerifier): Hono {
  const routes = new Hono();

  routes.get('/', async (context) => {
    await authenticate(auth, context.req.header('authorization'), ['admin']);
    const rows = await staff.list();
    return context.json(staffSummarySchema.array().parse(rows));
  });

  routes.post('/', async (context) => {
    await authenticate(auth, context.req.header('authorization'), ['admin']);
    const input = staffProvisionSchema.parse(await readJsonBody(context));
    const created = await staff.provision(input);
    return context.json(staffSummarySchema.parse(created), 201);
  });

  return routes;
}
