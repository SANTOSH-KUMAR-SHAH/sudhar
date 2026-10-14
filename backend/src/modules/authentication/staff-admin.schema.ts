// Business: an admin creating a login for a colleague. Role is only ever admin or technician — a
// Business: customer has no login in this system by design.
// Technical: the RESPONSE schema deliberately omits `secret`, so returning a list or a created account
// can never expose a credential; the shape itself is the guarantee.
import { z } from 'zod';

export const staffSummarySchema = z.object({
  id: z.string(),
  role: z.enum(['admin', 'technician']),
  identifier: z.string(),
});

export type StaffSummary = z.infer<typeof staffSummarySchema>;

export const staffProvisionSchema = z
  .object({
    identifier: z.string().min(3, 'Username must be at least 3 characters'),
    secret: z.string().min(6, 'Password must be at least 6 characters'),
    role: z.enum(['admin', 'technician']),
    technicianId: z.string().optional(),
  })
  // A technician login must point at a real technician, or "accept only your own jobs" has no anchor.
  .refine((input) => input.role !== 'technician' || Boolean(input.technicianId), {
    message: 'A technician login needs a technicianId',
    path: ['technicianId'],
  });

export type StaffProvisionInput = z.infer<typeof staffProvisionSchema>;
