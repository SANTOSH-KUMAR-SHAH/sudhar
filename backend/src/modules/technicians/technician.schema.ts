// Business: The shape the roster and a single technician are served in — one contract for the admin
// Business: "who's available" screen and the technician profile.
// Technical: Zod schemas mirroring TechnicianRecord; the roster adds activeJobs, which is always derived.

import { z } from 'zod';

export const availabilitySchema = z.enum(['online', 'offline']);

export const technicianRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  area: z.string(),
  availability: availabilitySchema,
  skills: z.array(z.string()),
});

export type TechnicianRecordView = z.infer<typeof technicianRecordSchema>;

// Business: activeJobs is the live workload — how many jobs this technician is on right now.
export const technicianRosterSchema = technicianRecordSchema.extend({
  activeJobs: z.number().int().nonnegative(),
});

export type TechnicianRosterView = z.infer<typeof technicianRosterSchema>;

// Business: The only thing a technician can change about themselves in the thin portal: online/offline.
export const availabilityChangeSchema = z.object({ availability: availabilitySchema });
