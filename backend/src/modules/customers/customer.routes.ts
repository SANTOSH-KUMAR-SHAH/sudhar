// Business: the admin reads the customer list and one customer's detail.
// Technical: same rule as the request routes — every response is parsed through the schema; a
// missing id is an explicit 404, never an empty body.
import { Hono } from 'hono';
import { authenticate } from '../authentication/guard';
import type { AuthVerifier } from '../authentication/principal';
import { customerRecordSchema } from './customer.schema';
import type { CustomerService } from './customer.service';

export function customerRoutes(customers: CustomerService, auth: AuthVerifier): Hono {
  const routes = new Hono();

  routes.get('/', async (context) => {
    await authenticate(auth, context.req.header('authorization'), ['admin']);
    const rows = await customers.list();
    return context.json(customerRecordSchema.array().parse(rows));
  });

  routes.get('/:id', async (context) => {
    await authenticate(auth, context.req.header('authorization'), ['admin']);
    const row = await customers.byId(context.req.param('id'));
    if (!row) return context.json({ error: 'not_found' }, 404);
    return context.json(customerRecordSchema.parse(row));
  });

  return routes;
}
