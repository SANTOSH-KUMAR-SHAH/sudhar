// Business: this is the shape of a job as the API hands it out. One definition means the admin,
// Business: technician and customer readers can never see different field names for the same thing.
// Technical: Zod schema mirroring the shared ServiceRequestRecord. Used to validate every response
// leaving the API (and writes in the next milestone), so the contract is enforced at runtime, not by hope.

import { z } from 'zod';
import { SERVICE_STATUSES } from '../../../../packages/shared/src/service-status';
import { ROLES } from '../../../../packages/shared/src/roles';
import { isValidNepalPhone, isValidRequestCode } from '../../../../packages/shared/src/validation';

export const serviceStatusSchema = z.enum(SERVICE_STATUSES);

export const priceRecordSchema = z.object({
  amount: z.number(),
  currency: z.literal('NPR'),
  invoiceNumber: z.string().optional(),
  paymentStatus: z.enum(['Paid', 'Pending']),
});

export const statusEventSchema = z.object({
  status: serviceStatusSchema,
  actor: z.enum(ROLES),
  at: z.string(),
  note: z.string().optional(),
});

export const serviceRequestRecordSchema = z.object({
  code: z.string(),
  status: serviceStatusSchema,
  source: z.enum(['Website', 'Phone']),
  customerId: z.string(),
  technicianId: z.string().nullable(),
  appliance: z.object({
    type: z.string(),
    brand: z.string(),
    model: z.string().optional(),
  }),
  problem: z.string(),
  fault: z.string().optional(),
  price: priceRecordSchema.optional(),
  visitDate: z.string().optional(),
  urgent: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  timeline: z.array(statusEventSchema),
});

export type ServiceRequestRecordView = z.infer<typeof serviceRequestRecordSchema>;

// Business: What a customer is allowed to submit. The phone rule is the SHARED one, so the API can
// Business: never accept a number the form would have rejected (and vice-versa).
// Business: Every free-text field now carries a hard ceiling: this endpoint is anonymous, so without a
// Business: max one bot could store megabytes per row and grow the database / bill at our expense.
// Technical: `.max()` bounds realistic form sizes; `source` is no longer a client field at all (see
// service.create) — an unauthenticated submit can no longer stamp a job as a phone-in to skip the SMS.
export const createRequestSchema = z.object({
  appliance: z.string().trim().min(1).max(60),
  brand: z.string().trim().min(1).max(60),
  model: z.string().trim().max(80).optional(),
  problem: z.string().trim().min(1).max(4000),
  name: z.string().trim().min(1).max(120),
  phone: z.string().refine(isValidNepalPhone, { message: 'Enter a valid Nepal mobile number' }),
  area: z.string().trim().min(1).max(120),
  visitDate: z.string().trim().max(40).optional(),
  urgent: z.boolean().optional(),
});

export type CreateRequestInput = z.infer<typeof createRequestSchema>;

// Business: What an admin (or technician) sends to move a job forward. The status machine — not this
// Business: schema — decides if the move is legal; here we only type the request and its side-effects.
// Business: NOTE: there is deliberately NO `actor` here — who performed a move comes from the verified
// Business: token in the route, never from the body, so no caller can claim to be someone they are not.
export const advanceRequestSchema = z.object({
  to: serviceStatusSchema,
  note: z.string().trim().max(4000).optional(),
  technicianId: z.string().trim().max(120).nullable().optional(),
  fault: z.string().trim().max(4000).optional(),
  price: priceRecordSchema.optional(),
});

// Technical: the shape the service consumes = the validated body. WHO acts is the verified principal
// passed separately by the route — never a field the caller can set.
export type AdvanceRequestInput = z.infer<typeof advanceRequestSchema>;

// Business: The Track box needs BOTH the phone and the code together (decision 0004) — a code alone is
// Business: not enough to show anyone's job. Same shared rules as everywhere else.
export const trackQuerySchema = z.object({
  phone: z.string().refine(isValidNepalPhone, { message: 'Enter a valid Nepal mobile number' }),
  code: z.string().refine(isValidRequestCode, { message: 'Enter a valid request code' }),
});

export type TrackQueryInput = z.infer<typeof trackQuerySchema>;

// Business: The public, safe slice a stranger-sees-on-their-phone is allowed to contain: only their own
// Business: status and what they asked us to fix. No internal notes, no technician id, no price, no timeline.
export const trackedRequestSchema = z.object({
  code: z.string(),
  status: serviceStatusSchema,
  appliance: z.object({ type: z.string(), brand: z.string() }),
  problem: z.string(),
  visitDate: z.string().optional(),
  updatedAt: z.string(),
});

export type TrackedRequestView = z.infer<typeof trackedRequestSchema>;

// Business: what an internal admin screen needs about a job — the full record PLUS the customer
// (who/where) and the assigned technician (who), resolved from their ids. This is the join the
// static demo pages assumed but the API never returned.
// Technical: extends the bare record with two small nested shapes; names come from the repositories,
// never recomputed. Labels / next-action wording stay a frontend concern — this is data, not a view.
export const adminRequestSchema = serviceRequestRecordSchema.extend({
  customer: z.object({ name: z.string(), phone: z.string(), area: z.string() }).nullable(),
  technician: z.object({ name: z.string(), phone: z.string() }).nullable(),
});

export type AdminRequestView = z.infer<typeof adminRequestSchema>;

// Business: For the admin's one-job screen we ALSO suggest who could take it — derived live from the
// Business: roster (skill matches the appliance, online now, fewest open jobs). This is computed from
// Business: data the system already has; it is a projection, never a stored or hand-typed list.
// Technical: Only exists on the detail view; the queue list stays lean (no recommendations per row).
export const recommendedTechnicianSchema = z.object({
  id: z.string(),
  name: z.string(),
  area: z.string(),
  availability: z.enum(['online', 'offline']),
  activeJobs: z.number().int().nonnegative(),
  matchReason: z.string(),
});

export type RecommendedTechnicianView = z.infer<typeof recommendedTechnicianSchema>;

export const adminRequestDetailSchema = adminRequestSchema.extend({
  recommendedTechnicians: z.array(recommendedTechnicianSchema),
});

export type AdminRequestDetailView = z.infer<typeof adminRequestDetailSchema>;

// Business: The technician's OWN job view — the full record PLUS who the customer is and how to reach
// Business: them (name/phone/area), because a visit cannot happen without the number. This is the
// Business: technician-safe join: only their assigned rows carry it, and it exposes nothing admin-only.
// Technical: Same nested customer shape as the admin view so both screens read one contract for a name.
export const technicianJobSchema = serviceRequestRecordSchema.extend({
  customer: z.object({ name: z.string(), phone: z.string(), area: z.string() }).nullable(),
});

export type TechnicianJobView = z.infer<typeof technicianJobSchema>;
