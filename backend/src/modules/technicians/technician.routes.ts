// Business: Everything the technician roster and the thin technician portal need to read or change.
// Technical: Owns /api/technicians/*. The jobs route lives here (it is a technician view) but reuses the
// request service — the data is still jobs, only the audience is the technician.

import { Hono } from 'hono';
import { AuthorizationError } from '../../domain/errors';
import { authenticate } from '../authentication/guard';
import type { AuthVerifier } from '../authentication/principal';
import { serviceRequestRecordSchema, technicianJobSchema } from '../service-requests/request.schema';
import type { RequestService } from '../service-requests/request.service';
import {
  availabilityChangeSchema,
  technicianRecordSchema,
  technicianRosterSchema,
} from './technician.schema';
import type { TechnicianService } from './technician.service';

export function technicianRoutes(
  technicians: TechnicianService,
  requests: RequestService,
  auth: AuthVerifier,
): Hono {
  const routes = new Hono();

  routes.get('/', async (context) => {
    await authenticate(auth, context.req.header('authorization'), ['admin', 'technician']);
    const roster = await technicians.roster();
    return context.json(technicianRosterSchema.array().parse(roster));
  });

  // Business: A signed-in technician reading THEMSELVES. Identity is taken from the verified token's
  // Business: subject, never from a path id, so "me" can only ever resolve to the caller — no probing,
  // Business: no reading another technician's profile or jobs. These come before /:id so `me` is literal.
  routes.get('/me', async (context) => {
    const principal = await authenticate(auth, context.req.header('authorization'), ['technician']);
    const technician = await technicians.getById(principal.subject);
    if (!technician) return context.json({ error: 'not_found' }, 404);
    return context.json(technicianRecordSchema.parse(technician));
  });

  routes.get('/me/jobs', async (context) => {
    const principal = await authenticate(auth, context.req.header('authorization'), ['technician']);
    const jobs = await requests.jobsForTechnicianView(principal.subject);
    return context.json(technicianJobSchema.array().parse(jobs));
  });

  // Business: The one self-serve write in the thin portal — flip your OWN availability. The target is the
  // Business: token subject, so there is no id in the path a technician could point at someone else.
  routes.post('/me/availability', async (context) => {
    const principal = await authenticate(auth, context.req.header('authorization'), ['technician']);
    const { availability } = availabilityChangeSchema.parse(await context.req.json());
    const updated = await technicians.setAvailability(principal.subject, availability);
    return context.json(technicianRecordSchema.parse(updated));
  });

  routes.get('/:id', async (context) => {
    await authenticate(auth, context.req.header('authorization'), ['admin', 'technician']);
    const technician = await technicians.getById(context.req.param('id'));
    if (!technician) return context.json({ error: 'not_found' }, 404);
    return context.json(technicianRecordSchema.parse(technician));
  });

  routes.get('/:id/jobs', async (context) => {
    const principal = await authenticate(auth, context.req.header('authorization'), ['admin', 'technician']);
    const id = context.req.param('id');
    // Business: a technician sees only their OWN jobs; the admin sees any (backend.md §5-2).
    if (principal.role !== 'admin' && principal.subject !== id) {
      throw new AuthorizationError('forbidden', 'A technician may only read their own jobs');
    }
    const jobs = await requests.jobsForTechnician(id);
    return context.json(serviceRequestRecordSchema.array().parse(jobs));
  });

  // Business: A technician flipping themselves online/offline — the only self-serve write in the portal.
  // Business: An admin may set anyone's; a technician may set ONLY their own (subject == the path id).
  routes.post('/:id/availability', async (context) => {
    const principal = await authenticate(auth, context.req.header('authorization'), ['admin', 'technician']);
    const id = context.req.param('id');
    if (principal.role !== 'admin' && principal.subject !== id) {
      throw new AuthorizationError('forbidden', 'A technician may only change their own availability');
    }
    const { availability } = availabilityChangeSchema.parse(await context.req.json());
    const updated = await technicians.setAvailability(id, availability);
    return context.json(technicianRecordSchema.parse(updated));
  });

  return routes;
}
