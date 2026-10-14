// Business: the admin's internal views of the queue — every job with its customer and technician
// names already attached, plus one job's full detail.
// Technical: a distinct surface from the public /api/requests so the joined shape stays separate;
// responses pass through adminRequestSchema (which itself refuses a leaked field by not declaring one).
import { Hono } from 'hono';
import { authenticate } from '../authentication/guard';
import type { AuthVerifier } from '../authentication/principal';
import { adminRequestDetailSchema, adminRequestSchema } from './request.schema';
import type { RequestService } from './request.service';

export function adminRequestRoutes(requests: RequestService, auth: AuthVerifier): Hono {
  const routes = new Hono();

  routes.get('/', async (context) => {
    await authenticate(auth, context.req.header('authorization'), ['admin']);
    const rows = await requests.listForAdmin();
    return context.json(adminRequestSchema.array().parse(rows));
  });

  routes.get('/:code', async (context) => {
    await authenticate(auth, context.req.header('authorization'), ['admin']);
    const row = await requests.detailForAdmin(context.req.param('code'));
    if (!row) return context.json({ error: 'not_found' }, 404);
    return context.json(adminRequestDetailSchema.parse(row));
  });

  return routes;
}
