// Business: What the admin submits to bring a technician into the world — who they are, how to reach them, what
// Business: they can fix, and the email + password they'll sign in with. The role is never in the body: this
// Business: endpoint only ever creates technicians, so there is nothing for a caller to over-claim.
// Technical: Zod guards the shape at the boundary. Skills must come from the shared appliance list, so a typo can
// Business: never quietly break job matching. The password is a write-only field — it is consumed to make the
// Business: Supabase login and never returned in any response (see the output schema, which omits it entirely).

import { z } from 'zod';
import { APPLIANCE_TYPES } from '../../../../packages/shared/src/appliances';
import { isValidNepalPhone } from '../../../../packages/shared/src/validation';

export const createTechnicianSchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  phone: z.string().refine(isValidNepalPhone, 'Enter a valid Nepali mobile number'),
  email: z.string().trim().toLowerCase().email('A valid sign-in email is required'),
  area: z.string().trim().min(1, 'Area is required'),
  skills: z
    .array(z.enum(APPLIANCE_TYPES))
    .min(1, 'Pick at least one skill'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type CreateTechnicianInput = z.infer<typeof createTechnicianSchema>;

// Business: What comes back is the roster card the admin just created — never the password.
export const createdTechnicianSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  area: z.string(),
  availability: z.enum(['online', 'offline']),
  skills: z.array(z.string()),
});

export type CreatedTechnicianView = z.infer<typeof createdTechnicianSchema>;
