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
  createdAt: z.string(),
  updatedAt: z.string(),
  timeline: z.array(statusEventSchema),
});

export type ServiceRequestRecordView = z.infer<typeof serviceRequestRecordSchema>;

// Business: What a customer is allowed to submit. The phone rule is the SHARED one, so the API can
// Business: never accept a number the form would have rejected (and vice-versa).
// Technical: Only fields the record actually stores are here — attachments/notes arrive with storage.
export const createRequestSchema = z.object({
  appliance: z.string().min(1),
  brand: z.string().min(1),
  model: z.string().optional(),
  problem: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().refine(isValidNepalPhone, { message: 'Enter a valid Nepal mobile number' }),
  area: z.string().min(1),
  visitDate: z.string().optional(),
  source: z.enum(['Website', 'Phone']).default('Website'),
});

export type CreateRequestInput = z.infer<typeof createRequestSchema>;

// Business: What an admin (or technician) sends to move a job forward. The status machine — not this
// Business: schema — decides if the move is legal; here we only type the request and its side-effects.
export const advanceRequestSchema = z.object({
  to: serviceStatusSchema,
  actor: z.enum(ROLES).default('admin'),
  note: z.string().optional(),
  technicianId: z.string().nullable().optional(),
  fault: z.string().optional(),
  price: priceRecordSchema.optional(),
});

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
