// Business: The thin HTTP layer for jobs — reads for the screens, and the two writes that matter:
// Business: a customer submitting, and an admin moving a job. Every body and response is Zod-checked.
// Technical: no business rules live here. The service owns the queries; this owns routing and codes.

import { Hono } from 'hono';
import { authenticate } from '../authentication/guard';
import type { AuthVerifier } from '../authentication/principal';
import {
  advanceRequestSchema,
  createRequestSchema,
  serviceRequestRecordSchema,
} from './request.schema';
import type { RequestQuery } from './request.repository';
import type { RequestService } from './request.service';

// Reads filter by status list / technician; unknown statuses simply match nothing (lenient on purpose).
function parseQuery(raw: Record<string, string | undefined>): RequestQuery {
  const query: RequestQuery = {};
  if (raw.status) {
    query.status = raw.status
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0) as RequestQuery['status'];
  }
  if (raw.technicianId) query.technicianId = raw.technicianId;
  return query;
}

export function requestRoutes(service: RequestService, auth: AuthVerifier): Hono {
  const routes = new Hono();

  routes.get('/', async (context) => {
    const items = await service.list(parseQuery(context.req.query()));
    return context.json(serviceRequestRecordSchema.array().parse(items));
  });

  routes.get('/:code', async (context) => {
    const code = context.req.param('code');
    const record = await service.byCode(code);
    if (!record) return context.json({ error: 'not_found', code }, 404);
    return context.json(serviceRequestRecordSchema.parse(record));
  });

  // Business: The public "submit" endpoint. A malformed body is rejected by Zod before any record is made.
  routes.post('/', async (context) => {
    const input = createRequestSchema.parse(await context.req.json());
    const created = await service.create(input);
    return context.json(serviceRequestRecordSchema.parse(created), 201);
  });

  // Business: The admin "advance" endpoint. It is STAFF-ONLY, and the actor recorded in the timeline is
  // Business: the verified caller — never whatever the body claimed. An illegal move throws and becomes a 409.
  routes.post('/:code/status', async (context) => {
    const code = context.req.param('code');
    const principal = await authenticate(auth, context.req.header('authorization'), ['admin', 'technician']);
    const input = advanceRequestSchema.parse(await context.req.json());
    const updated = await service.advance(code, input, principal);
    return context.json(serviceRequestRecordSchema.parse(updated));
  });

  return routes;
}
