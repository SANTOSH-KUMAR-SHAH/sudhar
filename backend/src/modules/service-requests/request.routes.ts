// Business: The thin HTTP layer for jobs — the two public writes that matter: a customer submitting, and
// Business: staff moving a job. Every body and response is Zod-checked; the submit reply is minimised.
// Technical: no business rules live here. The service owns the queries; this owns routing and codes.

import { Hono } from 'hono';
import { readJsonBody } from '../../lib/http';
import type { RateLimiter } from '../../lib/rate-limit';
import { customerIdForPhone } from '../customers/customer.repository';
import { authenticate } from '../authentication/guard';
import type { AuthVerifier } from '../authentication/principal';
import {
  advanceRequestSchema,
  createRequestSchema,
  serviceRequestRecordSchema,
} from './request.schema';
import type { RequestService } from './request.service';

export function requestRoutes(
  service: RequestService,
  auth: AuthVerifier,
  limiter?: RateLimiter,
): Hono {
  const routes = new Hono();

  // Business: The public "submit" endpoint. A malformed or over-long body is rejected by Zod before any
  // Business: record is made, and the response carries ONLY the customer's own confirmation (code + status)
  // Business: — never the internal customer id, technician id, price or timeline.
  // Business: The body is read through a hard byte ceiling, and one phone may only open three jobs an hour:
  // Business: that is enough for a household and far too little to use this form as an SMS-bombing tool.
  // Security: the budget is keyed by the SAME normalised identity the customer record uses, so `+977 98…` and
  // Security: `98…` spend one allowance — otherwise the two spellings would double it.
  // Security: The former public GET "/" and GET "/:code" (whole-queue / any-record reads) are GONE. They
  // returned the FULL record — phone-derived customerId, fault notes, price, timeline — to anonymous callers
  // and were used by no screen. Staff read the queue via the guarded /api/admin/requests[/:code] instead.
  routes.post('/', async (context) => {
    const input = createRequestSchema.parse(await readJsonBody(context));
    if (limiter && !limiter.allow(`intake-phone:${customerIdForPhone(input.phone)}`)) {
      return context.json({ error: 'rate_limited' }, 429);
    }
    const created = await service.create(input);
    return context.json({ code: created.code, status: created.status }, 201);
  });

  // Business: The admin "advance" endpoint. It is STAFF-ONLY, and the actor recorded in the timeline is
  // Business: the verified caller — never whatever the body claimed. An illegal move throws and becomes a 409.
  routes.post('/:code/status', async (context) => {
    const code = context.req.param('code');
    const principal = await authenticate(auth, context.req.header('authorization'), ['admin', 'technician']);
    const input = advanceRequestSchema.parse(await readJsonBody(context));
    const updated = await service.advance(code, input, principal);
    return context.json(serviceRequestRecordSchema.parse(updated));
  });

  return routes;
}
